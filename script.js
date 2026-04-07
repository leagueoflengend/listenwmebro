// --- QUẢN LÝ GIAO DIỆN (THEME) ---
function toggleTheme() {
    const body = document.body;
    const icon = document.getElementById('theme-icon');
    
    body.classList.toggle('dark-theme');
    
    if (body.classList.contains('dark-theme')) {
        icon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'dark');
    } else {
        icon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'light');
    }
}

// Kiểm tra theme đã lưu khi vừa tải trang
(function() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        document.getElementById('theme-icon').className = 'fas fa-sun';
    }
})();

// --- TỰ ĐỘNG TẮT SEARCH KHI CLICK RA NGOÀI ---
window.addEventListener('click', function(e) {
    const box = document.getElementById('searchResultsBox');
    const input = document.getElementById('youtubeLink');
    if (box.style.display === 'block' && !box.contains(e.target) && e.target !== input) {
        closeSearch();
    }
});

// Sửa lại hàm Search để có nút Đóng
function searchSong() {
    const q = youtubeLinkInput.value.trim();
    if (!q) return;
    
    searchResultsBox.style.display = 'block';
    searchResultsBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; padding:5px 10px; background:var(--playlist-bg); border-radius:5px 5px 0 0">
            <small>KẾT QUẢ</small>
            <span onclick="closeSearch()" style="cursor:pointer; color:#f7768e; font-weight:bold;">[X Đóng]</span>
        </div>
        <div id="searchInner" style="text-align:center; padding:10px;">Đang tìm...</div>
    `;
    socket.emit('searchSong', q);
}

// Cập nhật hàm nhận kết quả tìm kiếm
socket.on('searchResults', (results) => {
    const inner = document.getElementById('searchInner');
    if (!inner) return;
    if (results.length === 0) { inner.innerHTML = "Không thấy bài nào!"; return; }

    inner.innerHTML = results.map(v => `
        <div class="search-item">
            <img src="${v.thumbnail}">
            <div class="search-info">
                <div class="search-title">${v.title}</div>
                <div style="font-size:0.8em; color:var(--sub-text)">${v.duration} • ${v.author}</div>
                <div style="margin-top:5px">
                    <button onclick="socket.emit('changeVideo','${v.id}');closeSearch()" style="padding:4px 8px; font-size:0.7em;">▶ Phát</button>
                    <button onclick="socket.emit('addToList','${v.id}');closeSearch()" class="btn-secondary" style="padding:4px 8px; font-size:0.7em;">+ Đợi</button>
                </div>
            </div>
        </div>
    `).join('');
});

// --- LOGIC NHẬP TÊN & ONLINE LIST ---
function joinRoom() {
    const nameInput = document.getElementById('joinNameInput');
    const name = nameInput.value.trim();
    if (!name) return alert("Vui lòng cho mình biết tên bạn!");
    
    socket.emit('join', name);
    document.getElementById('joinModal').style.display = 'none';
}

socket.on('updateUserList', (names) => {
    const count = document.getElementById('userCount');
    const list = document.getElementById('userList');
    count.innerText = names.length;
    list.innerHTML = names.map(n => `<span style="background:var(--accent-color); color:#fff; padding:2px 8px; border-radius:10px; font-size:0.8em; margin-right:5px;">${n}</span>`).join('');
});
