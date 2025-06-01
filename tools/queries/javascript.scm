;; JavaScript/TypeScript import-only query
;; Captures ES6 imports, CommonJS requires, and TypeScript imports

;; ES6 imports: import foo from 'bar'
(import_statement
  source: (string) @import.source)

;; ES6 named imports: import { foo } from 'bar'  
(import_statement
  source: (string) @import.source
  (import_specifier name: (identifier) @import.name))

;; CommonJS requires: require('foo')
(call_expression
  function: (identifier) @_require
  arguments: (arguments (string) @import.source)
  (#eq? @_require "require"))

;; Dynamic imports: import('foo')
(call_expression
  function: (import) @_import
  arguments: (arguments (string) @import.source))

;; TypeScript type imports: import type { Foo } from 'bar'
(import_statement
  (import_clause (named_imports)) 
  source: (string) @import.source)