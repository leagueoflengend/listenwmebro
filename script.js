// --- XỬ LÝ CLICK RA NGOÀI ĐỂ TẮT SEARCH ---
window.addEventListener('click', function(e) {
    if (!searchResultsBox.contains(e.target) && e.target !== youtubeLinkInput) {
        closeSearch();
    }
});

// --- TÍNH NĂNG JOIN PHÒNG ---
function joinRoom() {
    const name = document.getElementById('joinNameInput').value.trim();
    if (!name) return alert("Bạn chưa nhập tên mà!");

    // Gửi tên lên server
    socket.emit('join', name);
    
    // Đồng bộ tên xuống ô chat luôn cho tiện
    document.getElementById('nickname').value = name;
    
    // Ẩn modal
    document.getElementById('joinModal').style.display = 'none';
}

// --- CẬP NHẬT DANH SÁCH TÊN ONLINE ---
socket.on('updateUserList', (userNames) => {
    const userListDiv = document.getElementById('userList');
    const countElem = document.getElementById('userCount');
    
    countElem.innerText = userNames.length;
    userListDiv.innerHTML = userNames.map(name => 
        `<span style="background: rgba(158, 206, 106, 0.1); padding: 2px 8px; border-radius: 12px; font-size: 0.9em;">${name}</span>`
    ).join('');
});

// Sửa lại hàm searchSong để thêm nút X đóng nhanh
function searchSong() {
    const q = youtubeLinkInput.value.trim();
    if (!q || getValidId()) return;
    
    searchResultsBox.style.display = 'block';
    searchResultsBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px; border-bottom: 1px solid #444;">
            <span style="color:#9ece6a; font-size:0.8em;">KẾT QUẢ</span>
            <button onclick="closeSearch()" style="background:none; color:#f7768e; border:none; cursor:pointer;">[Đóng X]</button>
        </div>
        <div id="searchContent" style="padding:10px; text-align:center;">Đang tìm...</div>
    `;
    socket.emit('searchSong', q);
}

// Cập nhật lại socket.on('searchResults') để nó nhét vào #searchContent thay vì ghi đè nút đóng
socket.on('searchResults', (results) => {
    const content = document.getElementById('searchContent');
    if (!content) return;
    
    if (results.length === 0) {
        content.innerHTML = "Không tìm thấy bài nào!";
        return;
    }

    content.innerHTML = results.map(v => `
        <div class="search-item">
            <img src="${v.thumbnail}">
            <div class="search-info">
                <div class="search-title">${v.title}</div>
                <div class="search-meta"><span>${v.duration}</span> • ${v.author}</div>
                <div class="search-actions">
                    <button onclick="socket.emit('changeVideo','${v.id}');closeSearch()">▶ Phát</button>
                    <button class="btn-secondary" onclick="socket.emit('addToList','${v.id}');closeSearch()">+ Đợi</button>
                </div>
            </div>
        </div>
    `).join('');
});
