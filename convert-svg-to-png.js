const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

// 讀取放大版 SVG (v3 - 圖文放大1.5倍)
const svgPath = path.join(__dirname, 'line-richmenu', 'richmenu-v3.svg');
const svg = fs.readFileSync(svgPath, 'utf8');

// 1. 標準版 2500x1686 (給 LINE 用)
console.log('生成標準版 (2500x1686)...');
const opts1x = {
    fitTo: { mode: 'width', value: 2500 },
    font: { loadSystemFonts: true }
};
const resvg1x = new Resvg(svg, opts1x);
const png1x = resvg1x.render().asPng();
const output1x = path.join(__dirname, 'line-richmenu', 'richmenu-1x.png');
fs.writeFileSync(output1x, png1x);
console.log(`✓ 標準版: ${(png1x.length / 1024).toFixed(0)} KB`);

// 2. 放大2倍版 5000x3372 (高清預覽)
console.log('生成放大版 (5000x3372)...');
const opts2x = {
    fitTo: { mode: 'width', value: 5000 },
    font: { loadSystemFonts: true }
};
const resvg2x = new Resvg(svg, opts2x);
const png2x = resvg2x.render().asPng();
const output2x = path.join(__dirname, 'line-richmenu', 'richmenu-2x.png');
fs.writeFileSync(output2x, png2x);
console.log(`✓ 放大版: ${(png2x.length / 1024 / 1024).toFixed(2)} MB`);

console.log('\n完成！');
console.log(`標準版 (LINE 用): ${output1x}`);
console.log(`放大版 (預覽用): ${output2x}`);
