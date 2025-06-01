;; C/C++ include-only query
;; Captures #include statements only, avoiding function definitions

;; Standard includes: #include <foo.h>
(preproc_include 
  path: (system_lib_string) @include.system)

;; Local includes: #include "foo.h"  
(preproc_include
  path: (string_literal) @include.local)

;; Conditional includes in #ifdef blocks
(preproc_ifdef
  (preproc_include path: (system_lib_string) @include.system))

(preproc_ifdef  
  (preproc_include path: (string_literal) @include.local))

;; Includes in #if blocks
(preproc_if
  (preproc_include path: (system_lib_string) @include.system))

(preproc_if
  (preproc_include path: (string_literal) @include.local))