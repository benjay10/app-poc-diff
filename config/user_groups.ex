alias Acl.Accessibility.Always, as: AlwaysAccessible
alias Acl.Accessibility.ByQuery, as: AccessByQuery
alias Acl.GraphSpec.Constraint.Resource.AllPredicates, as: AllPredicates
alias Acl.GraphSpec.Constraint.Resource.NoPredicates, as: NoPredicates
alias Acl.GraphSpec.Constraint.Resource, as: ResourceConstraint
alias Acl.GraphSpec.Constraint.ResourceFormat, as: ResourceFormatConstraint
alias Acl.GraphSpec, as: GraphSpec
alias Acl.GroupSpec, as: GroupSpec
alias Acl.GroupSpec.GraphCleanup, as: GraphCleanup

defmodule Acl.UserGroups.Config do

  def user_groups do
    # These elements are walked from top to bottom.  Each of them may
    # alter the quads to which the current query applies.  Quads are
    # represented in three sections: current_source_quads,
    # removed_source_quads, new_quads.  The quads may be calculated in
    # many ways.  The useage of a GroupSpec and GraphCleanup are
    # common.
    [
      %GroupSpec{
        name: "public",
        useage: [:read, :write],
        access: %AlwaysAccessible{},
        graphs: [ %GraphSpec{
                    graph: "http://mu.semte.ch/graphs/public",
                    constraint: %ResourceFormatConstraint{
                      resource_prefix: ""
                    }
                  }
#                    constraint: %ResourceConstraint{
#                      source_graph: "http://mu.semte.ch/application",
#                      resource_types: [
#                        "http://schema.org/Author",
#                        "http://schema.org/Book",
#                        "http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#FileDataObject"
#                      ],
#                      predicates: %AllPredicates{} } }
#                      #inverse_predicates: %NoPredicates{} } }
                ] },

      # // CLEANUP
      %GraphCleanup{
        originating_graph: "http://mu.semte.ch/application",
        useage: [:write],
        name: "clean"
      }
    ]
  end
end

