var tsiClient = new TsiClient();
tsiClient.server.getAvailability(null, 'localhost:8080').then(availability => {
    debugger;
    console.log(availability);
});

tsiClient.server.getEventSchema(null, 'localhost:8080', 0, Number.MAX_SAFE_INTEGER).then(eventSchema => {
    debugger;
    console.log(eventSchema);
});

