package tree_sitter_oracle_plsql_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_oracle_plsql "github.com/hrushikeshpawar/tree-sitter-oracle_plsql/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_oracle_plsql.Language())
	if language == nil {
		t.Errorf("Error loading OraclePlsql grammar")
	}
}
