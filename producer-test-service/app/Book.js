function Book(sequence) {
  this.uuid = sequence;
  this.headline = `Book${sequence}`;
  this.uri = `bks:book${sequence}`;
}

Book.prototype.insertQueryBody = function () {
  return `${this.uri} a sch:Book ;
            mu:uuid      "${this.uuid}" ;
            sch:headLine "Book${this.uuid}" .`;
};

Book.prototype.deleteQueryBody = function () {
  return this.insertQueryBody();
};

Book.prototype.changeAndQueryBodies = function () {
  let oldHeadline = this.headline;
  this.headline = `Interesting book${this.uuid}`;
  return {
    inserts: `${this.uri} sch:headLine "${oldHeadline}" .`,
    deletes: `${this.uri} sch:headLine "${this.headline}" .`
  };
};

let counter = 0;

function clear() {
  counter = 0;
}

function makeBooks(n) {
  let books = [];
  for (let i = counter; i < counter + n; i++) {
    books.push(new Book(i));
  }
  counter += n;
  return books;
}

function changeRandomBooks(n, books) {
  //Take n random books, change them, and return their update queries
  let results = [];
  let randomIndex;
  for (let i = 0; i < n; i++) {
    randomIndex = Math.floor(Math.random() * books.length);
    results.push(books[randomIndex].changeAndQueryBodies());
  }
  return results;
}

export {
  Book,
  clear,
  makeBooks,
  changeRandomBooks
}

