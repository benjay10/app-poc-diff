## To Do

- Fix removal of books
    > Books are not correctly removed anymore
    * [ ] Fix!
- Rethink graphs
    > Rethink in which graphs stuff is put. Graphs for history, diffs on the consumer, status of tasks, sequence number state, ...
- General cleanup
    > Some random task to do for cleaning up
    * [ ] Npm request and request-promise still used somewhere? Remove
    * [ ] Request and request-promise still in package.json or as imports, remove
    * [ ] Remove old JS files on the consumer, lib folder
- Bugs
    * [ ] Mu-authorization tries to execute queries that are too large(?). Inserting 100 books at once gives +-1000 triples in history. It could easily split that up for us.
    * [ ] Requests quickly become too large, find a way to always produce large, but never too large queries to send to the database.
- Graphs in history
    > Triples are spread accross graphs based on user groups, that are determined at the time the user makes a request to store or delete some data. This can not simply be recreated on the consumer side. Also store the destination graph in the history!
    * [ ] Delta notifier needs to give graph information
    * [ ] Add graph to history
    * [ ] Consumer stores data in correct graphs
- Make README
    * [ ] Make nice diagram with details about file data formats
    * [ ] Make information flow graph between services, tunnels, etc.
    * [x] Remove old information
    * [x] Update information to reflect the new system
- Failing tests
    > Some data on /tests is not correct yet.
    * [ ] Tests have succeeded before, is this some race condition that only happens sometimes?

## Doing


## Done

- Make aliases
    > Create aliases for easier docker-compose control and not just as scripts.
- Import web project
    > Make a fork of original project.
    * [x] Make fork
    * [x] Import webapps
    * [x] Create new containers for apps
    * [x] Fix fetch problem
    * [x] Get webapp inside the dispatcher
    * [x] Bump versions of services
    * [x] Figure out why no data access
- File service
    > Setup file service and make work for simple test.
    * [x] Import service in Docker
    * [x] Configure
    * [x] Adapt webapp with file upload
- General stuff
    > Some random items
    * [x] Create file with frequent queries
    * [x] A documentation page with future work and nice to haves
- New layout
    > The Tailwind CSS is bad. Use Boostrap and clean up. I know that this is waste of time, but it keeps me productive when slacking.
    * [x] Remove traces of Tailwind
    * [x] Import Ember Bootstrap
    * [x] Create navigation bar in separate component
    * [x] Rewrite Books
    * [x] Rewrite Files
- Fix communication
    > Communication between the consumer and producer doesn't work yet
    * [x] Create keys and set up tunnel
    * [x] Check the tunnel
    * [x] Observe logs and communication
- User fileservice for delta
    > ABANDONED (changed to uploading history triples) Instead of saving a file locally in the producer, inserting the triples about the file, and then rely on the fileservice to read the database and files from a shared Docker volume, use the file service!
    * [x] Configure no shared volumes
    * [x] Send array of delta's to the file service
    * [x] Make sure file can be downloaded from consumer
- Delta files to db
    > Delta files are clonky. Save this information in separate graph in triplestore? Bypass authorization and construct own SPARQL queries. Do this with enough metadata such that consumers can get deltas from a certain point onwards; sequence number(?), vector clocks(?), ...
    * [x] Implement history tiple save
    * [x] Retreive history triples since a sequence number
    * [x] Consumer consumes history triples correctly instead of files
    * [x] Store inserts
    * [x] Store deletes
- Delta Notifier
    > The Delta Notifier is not superb. Improve!
    * [x] Setup my own image of the delta notifier
    * [x] Use string includes instead of exact equqality
    * [x] Remove dependency to deprecated request
- Restructure code
    * [x] Sequence number getting/setting in a module?
    * [x] Putting and getting deltas in module?
- Make testsystem
    > Make a system that stresses the delta and diff system a little and also checks the end result of the replication.
    * [x] Able to clear databases
    * [x] Able to construct queries
    * [x] Execute test queries
    * [x] Retreive full databases
    * [x] Display results of check (diff in html?)
    * [x] Diff in nicer looking format
    * [x] Make tests about book changes as described in GET:/test
- File diffs
    > Actually filter for files on the consumer and retreive them.
    * [x] Run hooks to filter on inserts and deletes
    * [x] Get physical files
    * [x] Post to file service (not very feasable because you would have to change the history entries and regular entries after uploading)
    * [x] Remove files that are removed in the triples
    * [x] Download files from other stack and save locally with same name
    * [x] Test manually
    * [x] Write automated test
