// Chạy: node test/load/prepare-load-test-data.js
// Tạo sẵn 50 user test + 1 chuyến bay riêng có nhiều ghế, để load test không ảnh hưởng dữ liệu thật
const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const USER_COUNT = 50;

async function main() {
  console.log(`Đang tạo ${USER_COUNT} user test...`);
  const users = [];

  for (let i = 0; i < USER_COUNT; i++) {
    const email = `loadtest_${Date.now()}_${i}@test.com`;
    try {
      await axios.post(`${BASE_URL}/auth/register`, {
        email, password: 'Test@12345', fullName: `Load Test User ${i}`,
      });
      users.push({ email, password: 'Test@12345' });
    } catch (err) {
      console.error(`Lỗi tạo user ${i}:`, err.response?.data?.message);
    }
  }

  console.log('Lưu danh sách user vào file để Artillery dùng...');
  fs.writeFileSync(
    'test/load/users.csv',
    'email,password\n' + users.map((u) => `${u.email},${u.password}`).join('\n'),
  );

  console.log(`Xong. Đã tạo ${users.length} user, lưu tại test/load/users.csv`);
  console.log('\n⚠️  LƯU Ý: các user này CHƯA verify OTP -- cần verify thủ công hoặc dùng admin bypass');
  console.log('Để load test không bị chặn bởi bước OTP, xem hướng dẫn bên dưới.');
}

main();