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
 * 延迟函数，用于异步等待
 * @param {number} ms 延迟的毫秒数
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 解析命名模板
 * 支持所有可能的组合：
 * 1. Slime(1,2)_[Idle,Move]_{Up,Down}_ - 三层：() [] {}
 * 2. Slime(1,2)_[Idle,Move]_ - 两层：() []
 * 3. Slime(1,2)_{Up,Down}_ - 两层：() {}
 * 4. Slime_[Idle,Move]_{Up,Down}_ - 两层：[] {}
 * 5. Slime(1,2)_ - 单层：()
 * 6. Slime_[Idle,Move]_ - 单层：[]
 * 7. Slime_{Up,Down}_ - 单层：{}
 * @param {string} template 命名模板
 * @returns {Object} 解析结果对象
 */
function parseNameTemplate(template) {
    // 1. 检查三层嵌套：() [] {}
    const tripleMatch = template.match(/^(.+?)\((.+?)\)(.+?)\[(.+?)\](.+?)\{(.+?)\}(.*)$/);
    if (tripleMatch) {
        return {
            hasPattern: true,
            patternType: 'triple',
            prefix: tripleMatch[1],
            middle1: tripleMatch[3],
            middle2: tripleMatch[5],
            postfix: tripleMatch[7],
            layer1: tripleMatch[2].split(',').map(s => s.trim()),  // ()
            layer2: tripleMatch[4].split(',').map(s => s.trim()),  // []
            layer3: tripleMatch[6].split(',').map(s => s.trim())   // {}
        };
    }
    
    // 2. 检查两层嵌套：() []
    const parenthesisBracketMatch = template.match(/^(.+?)\((.+?)\)(.+?)\[(.+?)\](.*)$/);
    if (parenthesisBracketMatch) {
        return {
            hasPattern: true,
            patternType: 'parenthesis-bracket',
            prefix: parenthesisBracketMatch[1],
            middle: parenthesisBracketMatch[3],
            postfix: parenthesisBracketMatch[5],
            layer1: parenthesisBracketMatch[2].split(',').map(s => s.trim()),  // ()
            layer2: parenthesisBracketMatch[4].split(',').map(s => s.trim())   // []
        };
    }
    
    // 3. 检查两层嵌套：() {}
    const parenthesisBraceMatch = template.match(/^(.+?)\((.+?)\)(.+?)\{(.+?)\}(.*)$/);
    if (parenthesisBraceMatch) {
        return {
            hasPattern: true,
            patternType: 'parenthesis-brace',
            prefix: parenthesisBraceMatch[1],
            middle: parenthesisBraceMatch[3],
            postfix: parenthesisBraceMatch[5],
            layer1: parenthesisBraceMatch[2].split(',').map(s => s.trim()),  // ()
            layer2: parenthesisBraceMatch[4].split(',').map(s => s.trim())   // {}
        };
    }
    
    // 4. 检查两层嵌套：[] {}
    const bracketBraceMatch = template.match(/^(.+?)\[(.+?)\](.+?)\{(.+?)\}(.*)$/);
    if (bracketBraceMatch) {
        return {
            hasPattern: true,
            patternType: 'bracket-brace',
            prefix: bracketBraceMatch[1],
            middle: bracketBraceMatch[3],
            postfix: bracketBraceMatch[5],
            layer1: bracketBraceMatch[2].split(',').map(s => s.trim()),  // []
            layer2: bracketBraceMatch[4].split(',').map(s => s.trim())   // {}
        };
    }
    
    // 5. 检查单层：()
    const parenthesisMatch = template.match(/^(.+?)\((.+?)\)(.*)$/);
    if (parenthesisMatch) {
        return {
            hasPattern: true,
            patternType: 'parenthesis',
            prefix: parenthesisMatch[1],
            postfix: parenthesisMatch[3],
            layer1: parenthesisMatch[2].split(',').map(s => s.trim())  // ()
        };
    }
    
    // 6. 检查单层：[]
    const bracketMatch = template.match(/^(.+?)\[(.+?)\](.*)$/);
    if (bracketMatch) {
        return {
            hasPattern: true,
            patternType: 'bracket',
            prefix: bracketMatch[1],
            postfix: bracketMatch[3],
            layer1: bracketMatch[2].split(',').map(s => s.trim())  // []
        };
    }
    
    // 7. 检查单层：{}
    const braceMatch = template.match(/^(.+?)\{(.+?)\}(.*)$/);
    if (braceMatch) {
        return {
            hasPattern: true,
            patternType: 'brace',
            prefix: braceMatch[1],
            postfix: braceMatch[3],
            layer1: braceMatch[2].split(',').map(s => s.trim())  // {}
        };
    }
    
    // 没有任何模式，返回简单模式
    return {
        hasPattern: false,
        template: template
    };
}

/**
 * 根据模板和行列生成文件名
 * @param {Object} namePattern 解析后的命名模板
 * @param {number} row 行号
 * @param {number} column 列号
 * @param {Object} rowColumnMap 行列计数器 {row: {columnIndex: number}, global: number}
 * @returns {string} 生成的文件名
 */
function generateFileName(namePattern, row, column, rowColumnMap) {
    // 获取该行的列计数（从1开始）
    if (!rowColumnMap[row]) {
        rowColumnMap[row] = { count: 0 };
    }
    rowColumnMap[row].count++;
    const colIndex = rowColumnMap[row].count;
    
    if (!namePattern.hasPattern) {
        // 简单模式：使用全局计数器
        if (!rowColumnMap.global) {
            rowColumnMap.global = 0;
        }
        rowColumnMap.global++;
        return `${namePattern.template}${rowColumnMap.global}.png`;
    }
    
    const rowIndex = row - 1;  // 转为0基索引
    
    // 根据不同的模式类型生成文件名
    switch (namePattern.patternType) {
        case 'triple': {
            // 三层：() [] {}
            const layer3Count = namePattern.layer3.length;
            const layer2Count = namePattern.layer2.length;
            const rowsPerLayer1 = layer2Count * layer3Count;
            
            const idx1 = Math.floor(rowIndex / rowsPerLayer1) % namePattern.layer1.length;
            const remaining = rowIndex % rowsPerLayer1;
            const idx2 = Math.floor(remaining / layer3Count);
            const idx3 = remaining % layer3Count;
            
            return `${namePattern.prefix}${namePattern.layer1[idx1]}${namePattern.middle1}${namePattern.layer2[idx2]}${namePattern.middle2}${namePattern.layer3[idx3]}${namePattern.postfix}${colIndex}.png`;
        }
        
        case 'parenthesis-bracket': {
            // 两层：() []
            const layer2Count = namePattern.layer2.length;
            const idx1 = Math.floor(rowIndex / layer2Count) % namePattern.layer1.length;
            const idx2 = rowIndex % layer2Count;
            
            return `${namePattern.prefix}${namePattern.layer1[idx1]}${namePattern.middle}${namePattern.layer2[idx2]}${namePattern.postfix}${colIndex}.png`;
        }
        
        case 'parenthesis-brace': {
            // 两层：() {}
            const layer2Count = namePattern.layer2.length;
            const idx1 = Math.floor(rowIndex / layer2Count) % namePattern.layer1.length;
            const idx2 = rowIndex % layer2Count;
            
            return `${namePattern.prefix}${namePattern.layer1[idx1]}${namePattern.middle}${namePattern.layer2[idx2]}${namePattern.postfix}${colIndex}.png`;
        }
        
        case 'bracket-brace': {
            // 两层：[] {}
            const layer2Count = namePattern.layer2.length;
            const idx1 = Math.floor(rowIndex / layer2Count) % namePattern.layer1.length;
            const idx2 = rowIndex % layer2Count;
            
            return `${namePattern.prefix}${namePattern.layer1[idx1]}${namePattern.middle}${namePattern.layer2[idx2]}${namePattern.postfix}${colIndex}.png`;
        }
        
        case 'parenthesis':
        case 'bracket':
        case 'brace': {
            // 单层：() 或 [] 或 {}
            const idx = rowIndex % namePattern.layer1.length;
            return `${namePattern.prefix}${namePattern.layer1[idx]}${namePattern.postfix}${colIndex}.png`;
        }
        
        default:
            return `unknown_${row}_${colIndex}.png`;
    }
}

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
    const showEmptyBlocks = util.$('showEmptyBlocks');

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
    showEmptyBlocks.onchange = updateRowColumn;

    // download
    download.onclick = async function () {
        const name = downloadName.value || 'pice'
        const images = document.querySelectorAll('img.piece')
        const showEmptyBlocks = util.$('showEmptyBlocks').checked;
        
        // 解析命名模板
        const namePattern = parseNameTemplate(name);
        
        // 禁用下载按钮，避免重复点击
        download.disabled = true;
        download.textContent = '正在下载...';
        
        let downloadCount = 0;
        let skippedCount = 0;
        const validImages = [];
        
        console.log('=== 开始智能下载 ===');
        console.log(`总图片数: ${images.length}`);
        console.log(`命名模板: ${name}`);
        console.log(`下载空白区块: ${showEmptyBlocks ? '是' : '否'}`);
        
        if (namePattern.hasPattern) {
            switch (namePattern.patternType) {
                case 'triple':
                    console.log(`识别到三层嵌套模式 () [] {}:`);
                    console.log(`  前缀: "${namePattern.prefix}"`);
                    console.log(`  第1层(小括号): [${namePattern.layer1.join(', ')}]`);
                    console.log(`  中间部分1: "${namePattern.middle1}"`);
                    console.log(`  第2层(方括号): [${namePattern.layer2.join(', ')}]`);
                    console.log(`  中间部分2: "${namePattern.middle2}"`);
                    console.log(`  第3层(花括号): [${namePattern.layer3.join(', ')}]`);
                    console.log(`  后缀: "${namePattern.postfix}"`);
                    const rowsPerLayer1 = namePattern.layer2.length * namePattern.layer3.length;
                    console.log(`  循环规则: 每${namePattern.layer3.length}行切换第2层, 每${rowsPerLayer1}行切换第1层`);
                    break;
                
                case 'parenthesis-bracket':
                    console.log(`识别到两层嵌套模式 () []:`);
                    console.log(`  前缀: "${namePattern.prefix}"`);
                    console.log(`  第1层(小括号): [${namePattern.layer1.join(', ')}]`);
                    console.log(`  中间部分: "${namePattern.middle}"`);
                    console.log(`  第2层(方括号): [${namePattern.layer2.join(', ')}]`);
                    console.log(`  后缀: "${namePattern.postfix}"`);
                    console.log(`  循环规则: 每${namePattern.layer2.length}行切换第1层`);
                    break;
                
                case 'parenthesis-brace':
                    console.log(`识别到两层嵌套模式 () {}:`);
                    console.log(`  前缀: "${namePattern.prefix}"`);
                    console.log(`  第1层(小括号): [${namePattern.layer1.join(', ')}]`);
                    console.log(`  中间部分: "${namePattern.middle}"`);
                    console.log(`  第2层(花括号): [${namePattern.layer2.join(', ')}]`);
                    console.log(`  后缀: "${namePattern.postfix}"`);
                    console.log(`  循环规则: 每${namePattern.layer2.length}行切换第1层`);
                    break;
                
                case 'bracket-brace':
                    console.log(`识别到两层嵌套模式 [] {}:`);
                    console.log(`  前缀: "${namePattern.prefix}"`);
                    console.log(`  第1层(方括号): [${namePattern.layer1.join(', ')}]`);
                    console.log(`  中间部分: "${namePattern.middle}"`);
                    console.log(`  第2层(花括号): [${namePattern.layer2.join(', ')}]`);
                    console.log(`  后缀: "${namePattern.postfix}"`);
                    console.log(`  循环规则: 每${namePattern.layer2.length}行切换第1层`);
                    break;
                
                case 'parenthesis':
                    console.log(`识别到单层模式 ():`);
                    console.log(`  前缀: "${namePattern.prefix}"`);
                    console.log(`  选项(小括号): [${namePattern.layer1.join(', ')}]`);
                    console.log(`  后缀: "${namePattern.postfix}"`);
                    console.log(`  循环规则: 每行按顺序使用不同选项`);
                    break;
                
                case 'bracket':
                    console.log(`识别到单层模式 []:`);
                    console.log(`  前缀: "${namePattern.prefix}"`);
                    console.log(`  选项(方括号): [${namePattern.layer1.join(', ')}]`);
                    console.log(`  后缀: "${namePattern.postfix}"`);
                    console.log(`  循环规则: 每行按顺序使用不同选项`);
                    break;
                
                case 'brace':
                    console.log(`识别到单层模式 {}:`);
                    console.log(`  前缀: "${namePattern.prefix}"`);
                    console.log(`  选项(花括号): [${namePattern.layer1.join(', ')}]`);
                    console.log(`  后缀: "${namePattern.postfix}"`);
                    console.log(`  循环规则: 每行按顺序使用不同选项`);
                    break;
            }
        }
        
        console.log(`正在检测图片...\n`);
        
        // 第一步：检测所有图片
        images.forEach((img) => {
            const index = img.dataset.index;
            const [rowStr, columnStr] = index.split('-');
            const row = parseInt(rowStr);
            const column = parseInt(columnStr);
            
            // 检查图片是否为空（无有效像素）
            const isEmpty = isImageEmpty(img);
            
            // 如果未勾选"显示空白区块"，则跳过空白图片
            if (!showEmptyBlocks && isEmpty) {
                skippedCount++;
                console.log(`跳过: ${row}-${column} (空白区块)`);
                return
            }
            
            validImages.push({ img, row, column, isEmpty });
        })
        
        const emptyCount = validImages.filter(item => item.isEmpty).length;
        const contentCount = validImages.length - emptyCount;
        console.log(`\n找到 ${validImages.length} 张图片（有效: ${contentCount}，空白: ${emptyCount}），开始下载...\n`);
        
        // 行列计数器，用于生成连续编号
        const rowColumnMap = {};
        
        // 第二步：延迟下载，避免浏览器限制
        for (let i = 0; i < validImages.length; i++) {
            const { img, row, column, isEmpty } = validImages[i];
            
            // 根据模板生成文件名
            const fileName = generateFileName(namePattern, row, column, rowColumnMap);
            
            downloadCount++;
            const typeLabel = isEmpty ? '(空白)' : '(有效内容)';
            console.log(`[${downloadCount}/${validImages.length}] 下载: ${row}-${column} => ${fileName} ${typeLabel}`);
            
            // 更新按钮文本显示进度
            download.textContent = `下载中 ${downloadCount}/${validImages.length}...`;
            
            downloadImage(img.currentSrc, fileName);
            
            // 每次下载后延迟，避免浏览器限制（每隔200ms下载一张）
            if (i < validImages.length - 1) {
                await sleep(200);
            }
        }
        
        console.log('\n=== 下载完成 ===');
        console.log(`成功下载: ${downloadCount}张`);
        if (!showEmptyBlocks) {
            console.log(`跳过: ${skippedCount}张 (空白区块)`);
        }
        console.log(`总计: ${images.length}张`);
        
        // 恢复下载按钮
        download.disabled = false;
        download.textContent = 'Download';
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
    const showEmptyBlocks = util.$('showEmptyBlocks').checked;

    if (typeof source === 'string') {
        const img = new Image();

        img.onload = function () {
            util.$('result').innerHTML = createPiece(img, rowVal, columnVal, sizeX, sizeY, showEmptyBlocks);
        };

        img.src = source;
    }
    else {
        util.$('result').innerHTML = createPiece(source, rowVal, columnVal, sizeX, sizeY, showEmptyBlocks);
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
 * @param {boolean=} showEmptyBlocks 是否显示空白区块，默认false
 */
function createPiece(img, row, column, sizeX, sizeY, showEmptyBlocks = false) {
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
            
            // 检查是否为空白区块（在清空前检测）
            const isEmpty = isImageEmptyByDataURL(ctx, wpiece, hpiece);
            
            ctx.clearRect(0, 0, wpiece, hpiece);
            
            // 根据showEmptyBlocks决定是否显示空白区块
            if (showEmptyBlocks || !isEmpty) {
                html += '<div><img data-index="' + (i+1) + '-' + (j+1) + '" class="piece" src="' + src + '" /></div>';
            } else {
                // 不显示但保留占位，便于布局
                html += '<div style="opacity:0.1;"><img data-index="' + (i+1) + '-' + (j+1) + '" class="piece" src="' + src + '" /></div>';
            }
        }
        html += '</div>';
    }
    html = '<div>' + html + '</div>';
    return html;
}

window.onload = initFile;

/**
 * 从Canvas上下文直接检测图片是否为空
 * @param {CanvasRenderingContext2D} ctx canvas上下文
 * @param {number} width 宽度
 * @param {number} height 高度
 * @returns {boolean} true表示图片为空，false表示有内容
 */
function isImageEmptyByDataURL(ctx, width, height) {
    try {
        // 获取像素数据
        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = imageData.data;
        
        let transparentCount = 0;
        let visibleCount = 0;
        let firstVisibleColor = null;
        let colorVariationCount = 0;
        
        const totalPixels = pixels.length / 4;
        const threshold = 10;
        
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const a = pixels[i + 3];
            
            if (a <= threshold) {
                transparentCount++;
            } else {
                visibleCount++;
                
                if (firstVisibleColor === null) {
                    firstVisibleColor = { r, g, b };
                } else {
                    if (Math.abs(r - firstVisibleColor.r) > 5 || 
                        Math.abs(g - firstVisibleColor.g) > 5 || 
                        Math.abs(b - firstVisibleColor.b) > 5) {
                        colorVariationCount++;
                    }
                }
            }
        }
        
        // 判断逻辑
        if (visibleCount === 0) {
            return true;
        }
        
        if (transparentCount > totalPixels * 0.1 && visibleCount > totalPixels * 0.05) {
            return false;
        }
        
        if (colorVariationCount > visibleCount * 0.1) {
            return false;
        }
        
        if (visibleCount > totalPixels * 0.95 && colorVariationCount < visibleCount * 0.05) {
            return true;
        }
        
        return false;
        
    } catch (e) {
        console.error('检测图片时出错:', e);
        return false;
    }
}

/**
 * 检测图片是否为空（无有效像素内容）
 * @param {HTMLImageElement} img 要检测的图片元素
 * @returns {boolean} true表示图片为空，false表示有内容
 */
function isImageEmpty(img) {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        
        // 将图片绘制到canvas
        ctx.drawImage(img, 0, 0);
        
        // 获取像素数据
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        
        let transparentCount = 0;      // 透明像素数量
        let visibleCount = 0;          // 可见像素数量
        let firstVisibleColor = null;  // 第一个可见像素的颜色
        let colorVariationCount = 0;   // 颜色变化的像素数量
        
        const totalPixels = pixels.length / 4;
        const threshold = 10;  // alpha阈值
        
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const a = pixels[i + 3];
            
            if (a <= threshold) {
                // 透明或几乎透明的像素
                transparentCount++;
            } else {
                // 可见像素
                visibleCount++;
                
                if (firstVisibleColor === null) {
                    // 记录第一个可见像素的颜色
                    firstVisibleColor = { r, g, b };
                } else {
                    // 检查颜色是否有变化
                    if (Math.abs(r - firstVisibleColor.r) > 5 || 
                        Math.abs(g - firstVisibleColor.g) > 5 || 
                        Math.abs(b - firstVisibleColor.b) > 5) {
                        colorVariationCount++;
                    }
                }
            }
        }
        
        // 判断逻辑：
        // 1. 如果没有可见像素，是空图片
        if (visibleCount === 0) {
            return true;
        }
        
        // 2. 如果既有透明像素又有可见像素，说明有形状/内容（比如带透明背景的角色）
        //    这种情况即使颜色单一也应该保留
        if (transparentCount > totalPixels * 0.1 && visibleCount > totalPixels * 0.05) {
            // 至少10%透明 + 至少5%可见 = 有内容
            return false;
        }
        
        // 3. 如果颜色有足够的变化，不是纯色背景
        if (colorVariationCount > visibleCount * 0.1) {
            // 至少10%的可见像素颜色不同
            return false;
        }
        
        // 4. 如果几乎全是同一种颜色（超过95%），可能是纯色背景
        if (visibleCount > totalPixels * 0.95 && colorVariationCount < visibleCount * 0.05) {
            return true;
        }
        
        // 5. 默认保留（保守策略）
        return false;
        
    } catch (e) {
        console.error('检测图片时出错:', e);
        // 出错时保守处理，认为图片非空
        return false;
    }
}

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
