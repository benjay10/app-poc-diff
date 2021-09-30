# Bugs?

## Data duplication in graph "application"

Mu-authorization pushed data in the default graph `http://mu.semte.ch/application` on top of the specified graphs in the `user_groups` configuration. This leads to duplication of data.

There is a GraphCleanup specification that is designed to eliminate this. Also tried with different versions of the mu-authorization to no avail (version beta0.0.5, beta0.0.7, latest).

## Removal from "empty"?

When removing a record in the Ember app, the resource sends the correct DELETE query to the authorization, but it is transformed into a SELECT query (presumably to check if any items actually need to be removed, before removing) on the wrong graph. The graph it refers to is `http://mu.semte.ch/graphs/empty` which can be found in the source code of the mu-authorization service. This problem should only appear when no active groups are found. How is this possible when data insertion works somewhat correctly (see previous paragraph for more problems)?

## Closed connections?

After every request, the following messages appear in the logs, sometimes immediately, but most after a few seconds:

	identifier_1     | 
	identifier_1     | 09:06:56.715 [error] GenServer #PID<0.1360.0> terminating
	identifier_1     | ** (stop) "Mint transport error"
	identifier_1     | Last message: {:tcp_closed, #Port<0.435>}
	identifier_1     | State: #PID<0.1360.0>
	dispatcher_1     | 
	dispatcher_1     | 09:07:11.776 [error] GenServer #PID<0.1399.0> terminating
	dispatcher_1     | ** (stop) "Mint transport error"
	dispatcher_1     | Last message: {:tcp_closed, #Port<0.396>}
	dispatcher_1     | State: #PID<0.1399.0>

Are these from the livereloading of the Ember app that times out? All requests have succeeded an properly closed, as far as I can tell from the Network monitoring in the browser tools (yes even the favicon.ico has been made to succeed properly).
