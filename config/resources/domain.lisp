(in-package :mu-cl-resources)

(defparameter *include-count-in-paginated-responses* t
  "when non-nil, all paginated listings will contain the number
   of responses in the result object's meta.")

(define-resource book ()
  :class (s-prefix "schema:Book")
  :properties `((:title :string ,(s-prefix "schema:headline"))
                (:isbn :string ,(s-prefix "schema:isbn"))
                (:publication-date :date ,(s-prefix "schema:datePublished"))
                (:genre :string ,(s-prefix "schema:genre"))
                (:language :string ,(s-prefix "schema:inLanguage"))
                (:number-of-pages :integer ,(s-prefix "schema:numberOfPages")))
  :has-many `((author :via ,(s-prefix "schema:author")
                      :as "authors"))
  :resource-base (s-url "http://mu.semte.ch/services/github/madnificent/book-service/books/")
  :on-path "books")

(define-resource author ()
  :class (s-prefix "schema:Author")
  :properties `((:name :string ,(s-prefix "schema:name")))
  :has-many `((book :via ,(s-prefix "schema:author")
                    :inverse t
                    :as "books"))
  :resource-base (s-url "http://mu.semte.ch/services/github/madnificent/book-service/authors/")
  :on-path "authors")
