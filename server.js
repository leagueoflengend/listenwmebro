// Thêm biến lưu trữ user ở đầu file
let users = {}; 

io.on('connection', (socket) => {
    // Khi người dùng gửi tên để join
    socket.on('join', (username) => {
        users[socket.id] = username || `Khách ${socket.id.substring(0,4)}`;
        
        // Gửi thông báo cho mọi người cập nhật danh sách tên
        io.emit('updateUserList', Object.values(users));
        console.log(`${users[socket.id]} đã vào phòng.`);
    });

    // ... các đoạn code search, play, pause giữ nguyên ...

    socket.on('disconnect', () => {
        if (users[socket.id]) {
            console.log(`${users[socket.id]} đã rời đi.`);
            delete users[socket.id];
            // Cập nhật lại danh sách sau khi có người thoát
            io.emit('updateUserList', Object.values(users));
        }
    });
});
