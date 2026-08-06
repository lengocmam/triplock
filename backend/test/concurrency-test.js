// Chạy: node test/concurrency-test.js
// YÊU CẦU: backend đang chạy (npm run start:dev), đã có sẵn ít nhất 1 chuyến bay + ghế trống,
// và 2 tài khoản test đã verify OTP.
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// ĐIỀN THÔNG TIN THẬT TRƯỚC KHI CHẠY
const USER_A = { email: 'testera@demo.com', password: 'Test@12345' };
const USER_B = { email: 'testerb@demo.com', password: 'Test@12345' };
const SEAT_ID = 'DÁN_1_SEAT_ID_ĐANG_AVAILABLE_VÀO_ĐÂY';
const FARE_CLASS_ID = 'DÁN_1_FARE_CLASS_ID_VÀO_ĐÂY';

async function login(creds) {
  const res = await axios.post(`${BASE_URL}/auth/login`, creds);
  return res.data.accessToken;
}

async function tryLockSeat(token) {
  try {
    const res = await axios.post(
      `${BASE_URL}/bookings/lock-seat/${SEAT_ID}`,
      { fareClassId: FARE_CLASS_ID },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.response?.data?.message };
  }
}

async function main() {
  console.log('Đang đăng nhập 2 tài khoản...');
  const [tokenA, tokenB] = await Promise.all([login(USER_A), login(USER_B)]);

  console.log('Bắn 2 request lock cùng ghế ĐỒNG THỜI...');
  const [resultA, resultB] = await Promise.all([tryLockSeat(tokenA), tryLockSeat(tokenB)]);

  console.log('Kết quả User A:', resultA.success ? '✅ THÀNH CÔNG' : `❌ ${resultA.error}`);
  console.log('Kết quả User B:', resultB.success ? '✅ THÀNH CÔNG' : `❌ ${resultB.error}`);

  const successCount = [resultA, resultB].filter((r) => r.success).length;

  if (successCount === 1) {
    console.log('\n🎉 PASS: đúng 1 trong 2 request thành công -- chống race condition hoạt động đúng');
  } else {
    console.log(`\n🚨 FAIL: có ${successCount} request thành công (kỳ vọng đúng 1) -- RACE CONDITION BUG!`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Lỗi chạy test:', err.message);
  process.exit(1);
});