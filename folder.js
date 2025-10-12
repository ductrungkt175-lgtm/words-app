// Utility functions
function getFolders() {
    return JSON.parse(localStorage.getItem('folders')) || [];
}

function saveFolders(folders) {
    localStorage.setItem('folders', JSON.stringify(folders));
}

function getVocabularies() {
    return JSON.parse(localStorage.getItem('vocabularies')) || [];
}

function saveVocabularies(vocabularies) {
    localStorage.setItem('vocabularies', JSON.stringify(vocabularies));
}

function getDaysUntilNextReview(nt) {
    const now = Date.now();
    const days = Math.ceil((nt - now) / (1000 * 60 * 60 * 24));
    return days;
}

function formatLastReviewTime(timestamp) {
    if (!timestamp || timestamp === 0) return '🕐 Chưa học';
    
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `🕐 ${day}/${month} ${hours}:${minutes}`;
}

function getFolderCodeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('folderCode');
}

// Display functions
function displayFolderInfo() {
    const currentFolderInfo = document.getElementById('currentFolderInfo');
    const folderCode = getFolderCodeFromURL();
    const folders = getFolders();
    const folder = folders.find(f => f.code === folderCode);
    if (folder) {
        currentFolderInfo.textContent = `${folder.code} - ${folder.name}`;
    } else {
        currentFolderInfo.textContent = `Thư mục không tồn tại: ${folderCode}`;
    }
}

function displayVocabulariesInFolder() {
    const vocabularyList = document.getElementById('vocabularyList');
    const folderCode = getFolderCodeFromURL();
    const vocabularies = getVocabularies();

    // Lọc các mục từ vựng hợp lệ (có w và m là chuỗi không rỗng)
    const folderVocabularies = vocabularies
        .filter(v => v.s === folderCode && v.w && typeof v.w === 'string' && v.m && typeof v.m === 'string')
        .sort((a, b) => a.w.localeCompare(b.w));

    if (folderVocabularies.length === 0) {
        vocabularyList.innerHTML = '<div class="no-data">Chưa có từ vựng nào trong thư mục này</div>';
        return;
    }

    vocabularyList.innerHTML = folderVocabularies.map(vocab => {
        const days = getDaysUntilNextReview(vocab.nt);
        const lastReview = formatLastReviewTime(vocab.lt);
        
        return `
            <div class="vocabulary-item">
                <div class="vocab-main">
                    <div class="word-en">${vocab.w}</div>
                    <div class="word-pronunciation">${vocab.p || ''}</div>
                    <div class="word-meaning">${vocab.m || ''}</div>
                </div>
                <div class="word-details">
                    <div class="word-level">Lv:${vocab.l || 0}</div>
                    <div class="word-days">${days}d</div>
                    <div class="word-last-review">${lastReview}</div>
                </div>
                <div class="word-actions">
                    <button class="delete-word-btn" onclick="deleteWord('${vocab.w}', '${vocab.m}')">Xóa</button>
                </div>
            </div>
        `;
    }).join('');
}

// Word management functions
function deleteWord(word, meaning) {
    const folderCode = getFolderCodeFromURL();
    if (confirm(`Bạn có chắc muốn xóa từ "${word}" - "${meaning}"?`)) {
        let vocabularies = getVocabularies();
        vocabularies = vocabularies.filter(v => !(v.s === folderCode && v.w === word && v.m === meaning));
        saveVocabularies(vocabularies);
        displayVocabulariesInFolder();
        alert('Đã xóa từ vựng!');
    }
}

// Duplicate management functions
function findAndRemoveDuplicates() {
    const folderCode = getFolderCodeFromURL();
    const vocabularies = getVocabularies();
    const folderVocabularies = vocabularies.filter(v => v.s === folderCode);

    // Tìm từ trùng
    const duplicates = {};
    folderVocabularies.forEach(vocab => {
        const key = `${vocab.w}|${vocab.m}`;
        if (!duplicates[key]) {
            duplicates[key] = [];
        }
        duplicates[key].push(vocab);
    });

    // Lọc ra chỉ những từ thực sự trùng (có từ 2 bản ghi trở lên)
    const realDuplicates = {};
    Object.keys(duplicates).forEach(key => {
        if (duplicates[key].length > 1) {
            realDuplicates[key] = duplicates[key];
        }
    });

    if (Object.keys(realDuplicates).length === 0) {
        alert('Không có từ trùng nào trong thư mục này!');
        return;
    }

    // Hiển thị thông tin từ trùng
    let duplicatesInfo = '<strong>Tìm thấy các từ trùng:</strong><br>';
    Object.keys(realDuplicates).forEach(key => {
        const [word, meaning] = key.split('|');
        duplicatesInfo += `• "${word}" - "${meaning}" (${realDuplicates[key].length} bản)<br>`;
    });

    const duplicatesInfoDiv = document.getElementById('duplicatesInfo');
    duplicatesInfoDiv.innerHTML = duplicatesInfo + 
        '<br><button class="delete-button" onclick="confirmRemoveDuplicates()">Xóa tất cả từ trùng</button>';
    duplicatesInfoDiv.classList.remove('hidden');

    // Lưu thông tin từ trùng để xóa sau
    window.currentDuplicates = realDuplicates;
}

function confirmRemoveDuplicates() {
    const folderCode = getFolderCodeFromURL();
    const realDuplicates = window.currentDuplicates;
    
    if (!realDuplicates || Object.keys(realDuplicates).length === 0) {
        alert('Không có từ trùng để xóa!');
        return;
    }

    if (confirm(`Bạn có chắc muốn xóa tất cả từ trùng? Sẽ giữ lại 1 bản của mỗi từ.`)) {
        let vocabularies = getVocabularies();
        let removedCount = 0;

        Object.keys(realDuplicates).forEach(key => {
            const duplicates = realDuplicates[key];
            // Giữ lại bản ghi đầu tiên, xóa các bản còn lại
            const toKeep = duplicates[0];
            const toRemove = duplicates.slice(1);
            
            // Xóa các bản trùng
            vocabularies = vocabularies.filter(v => 
                !(v.s === folderCode && 
                  v.w === toKeep.w && 
                  v.m === toKeep.m && 
                  v !== toKeep)
            );
            
            removedCount += toRemove.length;
        });

        saveVocabularies(vocabularies);
        document.getElementById('duplicatesInfo').classList.add('hidden');
        displayVocabulariesInFolder();
        alert(`Đã xóa ${removedCount} từ trùng!`);
    }
}

// Import functions
function createFolderIfNotExists(folderCode) {
    const folders = getFolders();
    const existingFolder = folders.find(f => f.code === folderCode);
    if (!existingFolder) {
        folders.push({ code: folderCode, name: '' });
        saveFolders(folders);
        return true;
    }
    return false;
}

function isDuplicateWord(vocabularies, newWord, newMeaning, folderCode) {
    return vocabularies.some(v => v.w === newWord && v.m === newMeaning && v.s === folderCode);
}

function processImportData(data, currentFolderCode) {
    let vocabularies = getVocabularies();
    let importedCount = 0;
    let duplicateCount = 0;
    let createdFolders = [];

    const items = Array.isArray(data) ? data : [data];

    items.forEach(item => {
        let targetFolderCode = item.s || currentFolderCode;
        if (createFolderIfNotExists(targetFolderCode)) {
            createdFolders.push(targetFolderCode);
        }

        if (!item.w || !item.m || isDuplicateWord(vocabularies, item.w, item.m, targetFolderCode)) {
            duplicateCount++;
            return;
        }

        vocabularies.push({
            s: targetFolderCode,
            w: item.w,
            p: item.p || '',
            m: item.m || '',
            l: item.l || 0,
            lt: item.lt || Date.now(),
            nt: item.nt || Date.now()
        });
        importedCount++;
    });

    saveVocabularies(vocabularies);

    let message = `Đã import ${importedCount} từ vựng thành công!`;
    if (duplicateCount > 0) message += `\n${duplicateCount} từ bị trùng hoặc không hợp lệ đã bỏ qua.`;
    if (createdFolders.length > 0) message += `\nĐã tạo ${createdFolders.length} thư mục mới: ${createdFolders.join(', ')}`;

    return { message, importedCount };
}

function importVocabularies(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            const currentFolderCode = getFolderCodeFromURL();
            
            const result = processImportData(data, currentFolderCode);
            alert(result.message);
            displayVocabulariesInFolder();
            event.target.value = '';
        } catch (error) {
            alert('Lỗi khi đọc file JSON: ' + error.message);
        }
    };
    reader.readAsText(file);
}

function importFromJsonText() {
    const jsonText = document.getElementById('jsonTextarea').value.trim();
    if (!jsonText) {
        alert('Vui lòng nhập nội dung JSON');
        return;
    }

    try {
        const data = JSON.parse(jsonText);
        const currentFolderCode = getFolderCodeFromURL();
        
        const result = processImportData(data, currentFolderCode);
        alert(result.message);
        displayVocabulariesInFolder();
        
        // Xóa nội dung textarea sau khi import thành công
        document.getElementById('jsonTextarea').value = '';
        
    } catch (error) {
        alert('Lỗi khi phân tích JSON: ' + error.message);
    }
}

// Folder management functions
function deleteFolder() {
    const folderCode = getFolderCodeFromURL();
    const folders = getFolders();
    const folder = folders.find(f => f.code === folderCode);

    if (!folder) {
        alert('Thư mục không tồn tại');
        return;
    }

    if (confirm(`Bạn có chắc muốn xóa thư mục "${folder.code} - ${folder.name}"?`)) {
        const updatedFolders = folders.filter(f => f.code !== folderCode);
        saveFolders(updatedFolders);

        let vocabularies = getVocabularies();
        vocabularies = vocabularies.filter(v => v.s !== folderCode);
        saveVocabularies(vocabularies);

        alert('Đã xóa thư mục thành công!');
        window.location.href = 'index.html';
    }
}

// UI control functions
function toggleJsonInput() {
    const container = document.getElementById('jsonInputContainer');
    const toggleBtn = document.getElementById('toggleJsonInput');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        toggleBtn.textContent = '📁 Quay lại chọn file';
    } else {
        container.classList.add('hidden');
        toggleBtn.textContent = '📝 Hoặc nhập trực tiếp JSON';
    }
}

function hideJsonInput() {
    const container = document.getElementById('jsonInputContainer');
    const toggleBtn = document.getElementById('toggleJsonInput');
    
    container.classList.add('hidden');
    toggleBtn.textContent = '📝 Hoặc nhập trực tiếp JSON';
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    const folderCode = getFolderCodeFromURL();
    if (!folderCode) {
        alert('Không tìm thấy thư mục');
        window.location.href = 'index.html';
        return;
    }

    try {
        displayFolderInfo();
        displayVocabulariesInFolder();
    } catch (error) {
        console.error('Lỗi khi hiển thị dữ liệu:', error);
        alert('Có lỗi khi tải dữ liệu thư mục. Vui lòng kiểm tra lại.');
    }

    document.getElementById('jsonFile').addEventListener('change', importVocabularies);
    document.getElementById('deleteFolderBtn').addEventListener('click', deleteFolder);
    document.getElementById('importJsonText').addEventListener('click', importFromJsonText);
    document.getElementById('toggleJsonInput').addEventListener('click', toggleJsonInput);
    document.getElementById('hideJsonInput').addEventListener('click', hideJsonInput);
    document.getElementById('removeDuplicatesBtn').addEventListener('click', findAndRemoveDuplicates);
});