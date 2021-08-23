module.exports = {
  self: {
    identity: "consumer1@redpencil.io",
    file: "consumer.asc",
    passphrase: "consumer1"
  },
  peers: [
    { identity: "producer@redpencil.io",
      file: "producer.asc",
      address: "http://tunnel-producer/secure" },
    {identity: "consumer2@redpencil.io",
     file: "consumer2.asc",
     address: "http://tunnel-consumer2/secure"}
  ]
};
