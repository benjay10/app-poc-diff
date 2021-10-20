function Book(sequence) {
  this.uuid = sequence;
  this.headline = `Book${sequence}`;
  this.uri = `bks:book${sequence}`;
}

//Returns the insert query body
Book.prototype.insertQueryBody = function () {
  return `${this.uri} a sch:Book ;
            mu:uuid      "${this.uuid}" ;
            sch:headLine "Book${this.uuid}" .`;
};

//Returns the delete query body, the same as the insert body really
Book.prototype.deleteQueryBody = function () {
  return this.insertQueryBody();
};

//Changes the book internally, and returns an object with the newly created triple and the triple to be removed in the database.
Book.prototype.changeAndQueryBodies = function () {
  let oldHeadline = this.headline;
  this.headline = `Interesting book ${Math.floor(Math.random() * 100)}-${this.uuid}`;
  return {
    inserts: `${this.uri} sch:headLine "${oldHeadline}" .`,
    deletes: `${this.uri} sch:headLine "${this.headline}" .`
  };
};

let counter = 0;

//Reset the numbering of the Books
function clear() {
  counter = 0;
}

//Make a number of random books
function makeBooks(n) {
  let books = [];
  for (let i = counter; i < counter + n; i++) {
    books.push(new Book(i));
  }
  counter += n;
  return books;
}

//Take n (a number) and a list of books and change n random books from the list.
//Returns a smaller list with only the changed triples (inserts and deletes).
function changeRandomBooks(n, books) {
  let results = [];
  let randomIndex;
  for (let i = 0; i < n; i++) {
    randomIndex = Math.floor(Math.random() * books.length);
    results.push(books[randomIndex].changeAndQueryBodies());
  }
  return results;
}

function pickRandomBooks(n, books) {
  let picks = [];
  for (let i = 0; i < n; i++) {
    picks.push(books[Math.floor(Math.random() * books.length)]);
  }
  return picks;
}

export {
  Book,
  clear,
  makeBooks,
  changeRandomBooks,
  pickRandomBooks
}

