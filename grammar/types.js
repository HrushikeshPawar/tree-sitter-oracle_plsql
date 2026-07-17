/**
 * Declaration-site types, type definitions, and D15 name-site chains.
 * Spec: docs/spec/02-blocks.md B13–B18, B24, B28–B31; DESIGN-NOTES D15.
 */

import { PREC, keyword, commaSep1 } from "./helpers.js";

/** @param {any} $ */
export function typeRules($) {
  return {
    // ------------------------------------------------------------------
    // D3 supertype `type` — type_spec + parameter_type
    // ------------------------------------------------------------------

    // D3 conceptual type family = type_spec | parameter_type (not a live
    // tree-sitter supertype — see grammar.js supertypes comment).
    // Fields name type_spec / parameter_type for role-specific CST.

    // Full declaration-site types (B24 / B28–B30).
    type_spec: ($) =>
      choice(
        // B28 — %TYPE / %ROWTYPE as attribute_reference (name-site object).
        alias($._name_site_attribute, $.attribute_reference),
        seq(keyword("ref"), $._name_site),
        prec.right(
          PREC.CALL + 1,
          seq($._name_site, $._type_precision),
        ),
        $._name_site,
      ),

    // B24 — unconstrained formals: no inline precision parens.
    parameter_type: ($) =>
      choice(
        alias($._name_site_attribute, $.attribute_reference),
        seq(keyword("ref"), $._name_site),
        $._name_site,
      ),

    // ------------------------------------------------------------------
    // D15 name-site: seed + `.` only (no call / no bare expression)
    // Shared by types, exception names, RELIES_ON lists.
    // ------------------------------------------------------------------

    _name_site: ($) =>
      choice(
        $.identifier,
        $.quoted_identifier,
        alias($._name_site_member, $.member_expression),
      ),

    _name_site_member: ($) =>
      prec.left(
        PREC.MEMBER,
        seq(
          field("object", $._name_site),
          ".",
          field("name", $.identifier),
        ),
      ),

    // name_site % attr — same fields as expression attribute_reference.
    _name_site_attribute: ($) =>
      prec(
        PREC.MEMBER + 1,
        seq(
          field("object", $._name_site),
          "%",
          field("attribute", $._attribute_name),
        ),
      ),

    // TYPE is reserved (L9); allow it (and ordinary ids) after `%`.
    _attribute_name: ($) =>
      choice(
        $.identifier,
        alias($._kw_type, $.identifier),
      ),

    // B17 / B30 — number_literal only; optional CHAR/BYTE length semantics.
    _type_precision: ($) =>
      seq(
        "(",
        $.number_literal,
        optional(seq(",", $.number_literal)),
        optional(choice(keyword("char"), keyword("byte"))),
        ")",
      ),

    // ------------------------------------------------------------------
    // Type definitions (B13–B18) — shared TYPE name IS heading
    // ------------------------------------------------------------------

    _type_definition_heading: ($) =>
      seq(
        $._kw_type,
        field("name", $.identifier),
        $._kw_is,
      ),

    // B15 — public parent with three named body shapes.
    collection_type_definition: ($) =>
      seq(
        $._type_definition_heading,
        choice(
          $.associative_array_type_body,
          $.nested_table_type_body,
          $.varray_type_body,
        ),
        ";",
      ),

    // Left-factored TABLE OF … [NOT NULL]; INDEX BY distinguishes assoc.
    _table_of_prefix: ($) =>
      seq(
        $._kw_table,
        $._kw_of,
        field("element_type", $.type_spec),
        optional(seq($._kw_not, $._kw_null)),
      ),

    associative_array_type_body: ($) =>
      seq(
        $._table_of_prefix,
        $._kw_index,
        $._kw_by,
        field("index_type", $.type_spec),
      ),

    nested_table_type_body: ($) => $._table_of_prefix,

    // B16 — VARRAY | VARYING ARRAY | ARRAY
    varray_type_body: ($) =>
      seq(
        choice(
          keyword("varray"),
          seq(keyword("varying"), keyword("array")),
          keyword("array"),
        ),
        "(",
        field("size", $.number_literal),
        ")",
        $._kw_of,
        field("element_type", $.type_spec),
        optional(seq($._kw_not, $._kw_null)),
      ),

    record_type_definition: ($) =>
      seq(
        $._type_definition_heading,
        keyword("record"),
        "(",
        commaSep1($.field_definition),
        ")",
        ";",
      ),

    // B12 grouping: optional [NOT NULL] default together.
    field_definition: ($) =>
      seq(
        field("name", $.identifier),
        field("type", $.type_spec),
        optional($._not_null_default),
      ),

    ref_cursor_type_definition: ($) =>
      seq(
        $._type_definition_heading,
        keyword("ref"),
        $._kw_cursor,
        optional(
          seq(keyword("return"), field("return_type", $.type_spec)),
        ),
        ";",
      ),

    // B13 — trailing ; required.
    subtype_definition: ($) =>
      seq(
        $._kw_subtype,
        field("name", $.identifier),
        $._kw_is,
        field("base_type", $.type_spec),
        optional($._subtype_constraint),
        optional(seq($._kw_not, $._kw_null)),
        ";",
      ),

    // B17 — sizes/precision = number_literal; optional unary on RANGE bounds.
    _subtype_constraint: ($) =>
      choice(
        seq(
          "(",
          $.number_literal,
          optional(seq(",", $.number_literal)),
          ")",
        ),
        seq(
          keyword("range"),
          optional(choice("+", "-")),
          $.number_literal,
          "..",
          optional(choice("+", "-")),
          $.number_literal,
        ),
        seq(
          keyword("character"),
          keyword("set"),
          choice($.identifier, $.quoted_identifier),
        ),
      ),

    // := | DEFAULT expression — only expression is fielded as `default`.
    _initializer: ($) =>
      seq(
        choice(":=", $._kw_default),
        field("default", $.expression),
      ),

    // Shared NOT NULL? + initializer (variables, record fields).
    _not_null_default: ($) =>
      seq(
        optional(seq($._kw_not, $._kw_null)),
        $._initializer,
      ),
  };
}
