/**
 * Flat declaration choice: items, cursors, nested subprograms, pragmas.
 * Spec: docs/spec/02-blocks.md B6–B12, B19–B27, B35; D16 pragmas.
 *
 * Collection/cursor variables share the name+type surface with scalars and
 * parse as variable_declaration (no separate public nodes without types).
 * record_variable_declaration is only the distinguishable %ROWTYPE form.
 */

import { keyword, commaSep1 } from "./helpers.js";

export function declarationRules() {
  return {
    // ------------------------------------------------------------------
    // declaration choice (B6–B11) — keyword-led first, then name-led
    // ------------------------------------------------------------------

    declaration: ($) =>
      choice(
        // Keyword-led type definitions (B11, B14)
        $.collection_type_definition,
        $.record_type_definition,
        $.ref_cursor_type_definition,
        $.subtype_definition,
        // Cursors (B19)
        $.cursor_declaration,
        $.cursor_definition,
        // Nested subprograms (B23–B27)
        $.function_declaration,
        $.function_definition,
        $.procedure_declaration,
        $.procedure_definition,
        // Pragma peer (B8 / D16)
        $.pragma_declaration,
        // Name-led items (B9–B10)
        $.exception_declaration,
        $.record_variable_declaration,
        $.variable_declaration,
      ),

    // Scalar + constant (B9–B10, B12). `type` field uses live D3 supertype.
    variable_declaration: ($) =>
      seq(
        field("name", $.identifier),
        optional(keyword("constant")),
        field("type", $.type),
        optional($._not_null_default),
        ";",
      ),

    // B9 — record variable with %ROWTYPE only (not every %attr).
    record_variable_declaration: ($) =>
      prec(
        2,
        seq(
          field("name", $.identifier),
          field(
            "type",
            alias($._rowtype_attribute, $.attribute_reference),
          ),
          ";",
        ),
      ),

    exception_declaration: ($) =>
      seq(field("name", $.identifier), $._kw_exception, ";"),

    // D16 / DIR10 — generic PRAGMA name [(args)] ;
    pragma_declaration: ($) =>
      seq(
        keyword("pragma"),
        field("name", $.identifier),
        optional(field("arguments", $.argument_list)),
        ";",
      ),

    // ------------------------------------------------------------------
    // Explicit cursors (B19–B22)
    // ------------------------------------------------------------------

    _cursor_heading: ($) =>
      seq(
        $._kw_cursor,
        field("name", $.identifier),
        optional(field("parameters", $.cursor_parameter_list)),
      ),

    // Forward: RETURN required, no IS (B19).
    cursor_declaration: ($) =>
      seq(
        $._cursor_heading,
        keyword("return"),
        field("type", $.type),
        ";",
      ),

    // Definition: IS query required; RETURN optional (B19–B20).
    cursor_definition: ($) =>
      seq(
        $._cursor_heading,
        optional(seq(keyword("return"), field("type", $.type))),
        $._kw_is,
        field("query", $.cursor_query),
        ";",
      ),

    // Opaque SELECT stub until embedded-SQL ticket (B20 / D7).
    cursor_query: ($) => seq($._kw_select, $._opaque_sql_no_semi),

    // B22 — cursor-specific IN-only parameters.
    cursor_parameter_list: ($) =>
      seq("(", commaSep1($.cursor_parameter), ")"),

    cursor_parameter: ($) =>
      seq(
        field("name", $.identifier),
        optional($._kw_in),
        field("type", $.parameter_type),
        optional($._initializer),
      ),

    // ------------------------------------------------------------------
    // Nested subprograms (B23–B27)
    // ------------------------------------------------------------------

    function_declaration: ($) =>
      seq($._function_heading, repeat($._function_property), ";"),

    function_definition: ($) =>
      seq(
        $._function_heading,
        repeat($._function_property),
        choice($._kw_is, $._kw_as), // B25 — anonymous; no is_or_as field
        $._subprogram_implementation,
      ),

    _function_heading: ($) =>
      seq(
        $._kw_function,
        field("name", $.identifier),
        optional(field("parameters", $.parameter_list)),
        keyword("return"),
        field("return_type", $.type),
      ),

    // B23 — nested function modifiers only.
    _function_property: ($) =>
      choice(
        keyword("deterministic"),
        keyword("pipelined"),
        keyword("parallel_enable"),
        seq(keyword("result_cache"), optional($._relies_on_clause)),
      ),

    _relies_on_clause: ($) =>
      seq(
        keyword("relies_on"),
        "(",
        commaSep1($._name_site),
        ")",
      ),

    procedure_declaration: ($) => seq($._procedure_heading, ";"),

    // B23 — nested procedures: no CREATE/package-only properties.
    procedure_definition: ($) =>
      seq(
        $._procedure_heading,
        choice($._kw_is, $._kw_as),
        $._subprogram_implementation,
      ),

    _procedure_heading: ($) =>
      seq(
        $._kw_procedure,
        field("name", $.identifier),
        optional(field("parameters", $.parameter_list)),
      ),

    // Shared [declare_section] body | call_spec ;  (B26)
    _subprogram_implementation: ($) =>
      choice(
        seq(
          optional(field("declarations", $.declare_section)),
          field("body", $.body),
        ),
        seq(field("call_spec", $.call_spec), ";"),
      ),

    // B26 — coarse LANGUAGE … envelope (deep call_spec → units).
    // Pieces stop before the definition's trailing `;`.
    call_spec: ($) =>
      seq(
        keyword("language"),
        field("language", $.identifier),
        repeat($._call_spec_piece),
      ),

    _call_spec_piece: ($) =>
      choice(
        $.string_literal,
        $.q_string_literal,
        $.number_literal,
        keyword("name"),
        keyword("library"),
        keyword("agent"),
        $.identifier,
        $._balanced_parens,
      ),

    // Full formal parameters (IN / OUT / IN OUT / NOCOPY).
    // List node + bare parameter_declaration children (D3).
    parameter_list: ($) =>
      seq("(", optional(commaSep1($.parameter_declaration)), ")"),

    parameter_declaration: ($) =>
      seq(
        field("name", $.identifier),
        choice(
          prec(
            2,
            seq(
              $._kw_in,
              keyword("out"),
              optional(keyword("nocopy")),
              field("type", $.parameter_type),
            ),
          ),
          prec(
            2,
            seq(
              keyword("out"),
              optional(keyword("nocopy")),
              field("type", $.parameter_type),
            ),
          ),
          prec(
            1,
            seq(
              optional($._kw_in),
              field("type", $.parameter_type),
              optional($._initializer),
            ),
          ),
        ),
      ),
  };
}
