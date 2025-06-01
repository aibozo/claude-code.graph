;; Python import-only query - captures just the import relationships
;; This avoids walking into function bodies, classes, etc.

;; Standard imports: import foo, import foo.bar
(import_statement 
  name: (dotted_name) @import.name)

;; From imports: from foo import bar
(import_from_statement
  module_name: (dotted_name) @import.module)

;; From imports with aliases: from foo import bar as baz  
(import_from_statement
  module_name: (dotted_name) @import.module
  name: (dotted_name) @import.name)

;; Relative imports: from .foo import bar
(import_from_statement
  module_name: (relative_module) @import.relative)