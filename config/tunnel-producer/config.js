module.exports = {
  self: {
    identity: "producer@redpencil.io",
    file: "producer.asc",
    passphrase: "producer"
  },
  peers: [
    {identity: "consumer1@redpencil.io",
     file: "consumer1.asc",
     allowed: ["http://identifier/sync/files",
               "http://identifier/files/"]
    },
    {identity: "consumer2@redpencil.io",
     file: "consumer2.asc",
     allowed: ["http://identifier/sync/files",
               "http://identifier/files/"]
    }
  ]
};
