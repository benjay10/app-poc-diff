module.exports = {
  self: {
    identity: "consumer1@redpencil.io",
    file: "consumer.asc",
    passphrase: "consumer1"
  },
  peers: [
    { identity: "producer@redpencil.io",
      file: "producer.asc",
      address: "http://tunnel-producer/secure" }
  ]
};
