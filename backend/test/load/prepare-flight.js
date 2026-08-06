const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('Lấy danh sách chuyến bay hiện có...');
  let flightsRes = await axios.get(`${BASE_URL}/flights`);

  // Nếu chưa có chuyến bay nào, seed thử 1 lần
  if (flightsRes.data.length === 0) {
    console.log('Chưa có chuyến bay nào, đang seed...');
    await axios.post(`${BASE_URL}/flights/seed`);
    flightsRes = await axios.get(`${BASE_URL}/flights`);
  }

  if (flightsRes.data.length === 0) {
    throw new Error('Không có chuyến bay nào để dùng cho load test, kiểm tra lại /flights/seed');
  }

  const firstFlight = flightsRes.data[0];
  console.log(`Dùng chuyến bay: ${firstFlight.flightCode} (${firstFlight.departureCity} → ${firstFlight.arrivalCity})`);

  const detail = await axios.get(`${BASE_URL}/flights/${firstFlight.id}`);
  const fareRes = await axios.get(`${BASE_URL}/flights/${firstFlight.id}/fares`);

  const config = {
    flightId: firstFlight.id,
    fareClassId: fareRes.data[0].id,
    seatIds: detail.data.seats.map((s) => s.id),
  };

  fs.writeFileSync('test/load/flight-config.json', JSON.stringify(config, null, 2));
  console.log(`Đã lưu config: ${config.seatIds.length} ghế khả dụng cho flight ${firstFlight.flightCode}`);
}

main().catch((err) => {
  console.error('Lỗi:', err.response?.data?.message || err.message);
  process.exit(1);
});