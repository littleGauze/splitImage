/**
 * @file split image into n * m pieces by upload or drag image
 * @author wxp
 */

/**
 * helper - 辅助函数
 *
 */
const util = {
    $: function (id) {
        return typeof id == 'string' ? document.getElementById(id) : null;
    },
    cancel: function (event) {
        event.preventDefault();
        event.stopPropagation();
    },
    val: function (value) {
        return value && value > 0 ? value : 1;
    }
};

/**
 * 文件预处理
 * 
 * @param {(string | File)} file 上传的文件对象或者url路径
 */
function handleFile(file) {
    if (!file) {
        return;
    }

    // 从其他页面拖拽图片，获取url路径，可能是data:url或者普通的url
    // todo: 兼容性不好,仅chrome支持
    if (typeof file === 'string') {
        const source = file.match(/src=(?:'|")(.+jpe?g|png|gif)/);

        if (!source) {
            alert('图片格式不合法！请上传jpg, png, gif, jpeg格式的图片');
            return;
        }

        const imgUrl = source[1];

        util.$('preview').innerHTML = '<img src="' + imgUrl + '" />';

        handlePiece(imgUrl);

        return;
    }

    if (!file.type || !file.type.match('image/')) {
        alert('图片格式不合法！请上传jpg, png, gif, jpeg格式的图片');
        return;
    }

    // 文件超过2M
    if (!file.size || !file.size > 2 * 1024 * 1024) {
        alert("请上传2M以内的图片哦，亲~~");
        return;
    }

    /**
     * blob文件读取完毕时触发
     *
     * @event
     * @param {Object} event
     */
    const reader = new FileReader();
    reader.onload = function (event) {
        source = event.target.result;
        util.$('preview').innerHTML = '<img src="' + source + '" />';
        handlePiece(source);
    };
    reader.readAsDataURL(file);
}

/**
 * 初始化事件绑定
 * 
 */
function initFile() {
    const previewDiv = util.$('preview');
    const fileInput = util.$('imgFile');
    const download = util.$('download');
    const downloadName = util.$('donwloadName');

    const row = util.$('row');
    const column = util.$('column');
    const sizeX = util.$('sizeX');
    const sizeY = util.$('sizeY');

    previewDiv.ondragenter = function (event) {
        util.cancel(event);
        this.style.borderColor = '#f00';
    };

    previewDiv.ondragover = function (event) {
        util.cancel(event);
    };

    previewDiv.ondragleave = function () {
        this.style.borderColor = '#ffd48d';
    };

    previewDiv.ondrop = function (event) {
        util.cancel(event);

        const file = event.dataTransfer.files[0];
        const html = event.dataTransfer.getData('text/html');

        this.style.borderColor = '#ffd48d';

        handleFile(file || html);
    };

    /**
     * 通过input上传的文件发生改变时触发
     * 
     * @event
     */
    fileInput.onchange = function () {
        handleFile(this.files[0]);
    };

    /**
     * 分割宫格行列数发生变化时触发
     * 
     * @event
     */
    row.onchange = updateRowColumn;
    column.onchange = updateRowColumn;
    sizeX.onchange = updateRowColumn;
    sizeY.onchange = updateRowColumn;

    // download
    download.onclick = function () {
        const name = downloadName.value || 'pice'
        const images = document.querySelectorAll('img.piece')
        images.forEach((img, i) => {
            downloadImage(img.currentSrc, `${name}${i + 1}.png`)
        })
    }

    function updateRowColumn() {
        let img = previewDiv.getElementsByTagName('img');

        img = img ? img[0] : null;
        handlePiece(img);
    }
}

/**
 * 图片碎片预处理
 * 
 * @param {(string | Image)} source 可以是图片路径或者图片对象
 */
function handlePiece(source) {
    if (!source) {
        return;
    }
    const rowVal = util.$('row').value;
    const columnVal = util.$('column').value;
    const sizeX = util.$('sizeX').value;
    const sizeY = util.$('sizeY').value;

    if (typeof source === 'string') {
        const img = new Image();

        img.onload = function () {
            util.$('result').innerHTML = createPiece(img, rowVal, columnVal, sizeX, sizeY);
        };

        img.src = source;
    }
    else {
        util.$('result').innerHTML = createPiece(source, rowVal, columnVal, sizeX, sizeY);
    }
}

/**
 * 生成图片碎片
 * 
 * @param {Image} img 
 * @param {number=} row 分割宫格的行数
 * @param {number=} column 分割宫格的列数
 * @param {number=} sizeX 分割块的宽
 * @param {number=} sizeY 分割块的高
 */
function createPiece(img, row, column, sizeX, sizeY) {
    const width = img.naturalWidth
    const height = img.naturalHeight
    if (sizeX) {
        column = Math.ceil(width / sizeX)
    }
    if (sizeY) {
        row = Math.ceil(height / sizeY)
    }

    row = util.val(row);
    column = util.val(column);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const wpiece = Math.floor(width / column);
    const hpiece = Math.floor(height / row);

    let src = '';
    let html = '';

    canvas.width = wpiece;
    canvas.height = hpiece;

    for (let i = 0; i < row; i++) {
        html += '<div style="display:flex;margin:10px 0;">';

        for (let j = 0; j < column; j++) {
            ctx.drawImage(
                img,
                j * wpiece, i * hpiece, wpiece, hpiece,
                0, 0, wpiece, hpiece
            );

            src = canvas.toDataURL();
            ctx.clearRect(0, 0, wpiece, hpiece)
            html += '<div><img class="piece" src="' + src + '" /></div>';
        }
        html += '</div>';
    }
    html = '<div>' + html + '</div>';
    return html;
}

window.onload = initFile;

function dataURLtoBlob(data) {
    const arr = data.split(',')
    const mime = arr[0].match(/:(.*?);/)[1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n)
    }
    return new Blob([u8arr], { type: mime })
}

function downloadImage(data, name) {
    const img = dataURLtoBlob(data)
    const file = new File([img], name)
    const a = document.createElement('a')
    a.style.position = 'absolute'
    a.style.zIndex = -1
    a.download = file.name
    const href = URL.createObjectURL(file)
    a.href = href
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(href)
}