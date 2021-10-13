let rules = [
  {
    match: {
      // Everything about books
      subject: {
        value: "http://mu.semte.ch/services/github/madnificent/book-service/books/",
        type: "uri"
      }
    },
    callback: {
      url: "http://producer/delta", method: "POST"
    },
    options: {
      resourceFormat: "v0.0.1",
      gracePeriod: 1000,
      ignoreFromSelf: true
    },
  },
  {
    match: {
      // Everything about books
      subject: {
        value: "http://mu.semte.ch/services/github/madnificent/book-service/books/",
        type: "uri"
      }
    },
    callback: {
      url: "http://resource/.mu/delta", method: "POST"
    },
    options: {
      resourceFormat: "v0.0.1",
      gracePeriod: 5000,
      ignoreFromSelf: true
    }
  }
];

export default rules;

