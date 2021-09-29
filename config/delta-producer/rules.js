export default [
  {
    match: {
      // Everything
    },
    callback: {
      url: "http://producer/delta", method: "POST"
    },
    options: {
      resourceFormat: "v0.0.1",
      gracePeriod: 1000,
      ignoreFromSelf: true
    }
  }//,
//  {
//    match: {
//      //Everything
//    },
//    callback: {
//      url: "http://resource/.mu/delta", method: "POST"
//    },
//    options: {
//      resourceFormat: "v0.0.1",
//      gracePeriod: 5000,
//      ignoreFromSelf: true
//    }
//  }
];
