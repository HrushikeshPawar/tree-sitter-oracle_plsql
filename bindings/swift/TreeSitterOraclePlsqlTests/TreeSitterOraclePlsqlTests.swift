import XCTest
import SwiftTreeSitter
import TreeSitterOraclePlsql

final class TreeSitterOraclePlsqlTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_oracle_plsql())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading OraclePlsql grammar")
    }
}
