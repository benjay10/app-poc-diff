module.exports = {
  producer: {
    identity: "producer@redpencil.io",
    file: "producer.asc",
    passphrase: "producer"
  },
  consumers: [
    {identity: "consumer1@redpencil.io",
     file: "consumer1.asc"},
    {identity: "consumer2@redpencil.io",
     file: "consumer2.asc"}
  ]
};
