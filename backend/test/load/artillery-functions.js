const flightConfig = require('./flight-config.json');

module.exports = {
  pickRandomSeat: function (context, events, done) {
    const randomSeat = flightConfig.seatIds[Math.floor(Math.random() * flightConfig.seatIds.length)];
    context.vars.seatId = randomSeat;
    context.vars.fareClassId = flightConfig.fareClassId;
    return done();
  },
};