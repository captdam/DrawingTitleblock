'use strict';
const titleblcok = async (files, callback) => {
	const doc = await PDFLib.PDFDocument.create();
	const font = await doc.embedFont(PDFLib.StandardFonts.TimesRoman);
	
	let src = { index: null, drawings: {}, pictures: {} };
	await Array.fromAsync(files, async x => {
		//console.log(x)
		if (x.type == 'text/csv' || x.type.includes('excel')) { // Even I drop a plain .csv file, Win FF says ms-excel
			src.index = await (new TextDecoder()).decode(await x.arrayBuffer());
		} else if (x.type == 'application/pdf') {
			src.drawings[x.name] = await PDFLib.PDFDocument.load(await x.arrayBuffer());
		} else if (x.type == 'image/jpeg') {
			src.pictures[x.name] = await doc.embedJpg(await x.arrayBuffer());
		} else if (x.type == 'image/png') {
			src.pictures[x.name] = await doc.embedPng(await x.arrayBuffer());
		}
	});
	//console.log(src);

	let task = null, option = null, content = null, line = null;
	try {
		let index = src.index.trim().split(/\n/g).map(x => x = x.replace(/\\n/g, "\n").split(','));
		for (line = 0; line < index.length; line++) {
			const list = index[line].map(t => t = t.trim()).filter(t => t != '');
			//console.log(list);
			let page;
			{
				const type = list.shift();
				if (type == '@BLANK') { // ['@BLANK', w, h]
					page = doc.addPage([list.shift() * 72, list.shift() * 72]);
				} else {
					[page] = await doc.copyPages(src.drawings[type], [list.shift() - 1]); // Page# starts at 1, index at 0
					page.setRotation(PDFLib.degrees(Number(list.shift())));
					doc.addPage(page);
				}
			}
			while (list.length) {
				task = list.shift();
				switch (task) {
					case 'X': { // ['X',dummy_field]
						option = {};
						content = list.shift();
					} break;
					case 'T': { // ['T', x, y, size, height, r, g, b, a, rotate, 'text to write']
						option = {
							x: list.shift() * 72, y: list.shift() * 72,
							size: list.shift() * 72, lineHeight: list.shift() * 72,
							color: PDFLib.rgb(Number(list.shift()), Number(list.shift()), Number(list.shift())), opacity: Number(list.shift()),
							rotate: PDFLib.degrees(Number(list.shift())),
						font: font};
						content = list.shift();
						page.drawText(content, option);
					} break;
					case 'P': { // ['P', x, y, w, h, rotate, picture_filename]
						option = {
							x: list.shift() * 72, y: list.shift() * 72,
							width: list.shift() * 72, height: list.shift() * 72,
							rotate: PDFLib.degrees(Number(list.shift())),
						};
						content = list.shift();
						page.drawImage(src.pictures[content], option);
					} break;
					case 'I': { // ['I', x, y, size, height, r, g, b, a, rotate, ref_col, ref_rowStart, ref_rowLen]
						option = {
							x: list.shift() * 72, y: list.shift() * 72,
							size: list.shift() * 72, lineHeight: list.shift() * 72,
							color: PDFLib.rgb(Number(list.shift()), Number(list.shift()), Number(list.shift())), opacity: Number(list.shift()),
							rotate: PDFLib.degrees(Number(list.shift())),
						font: font};
						const ref_col = list.shift() - 1, ref_rowStart = list.shift() - 1, ref_rowEnd = ref_rowStart +  Number(list.shift());
						content = '';
						for (let i = ref_rowStart; i < ref_rowEnd; i++) {
							content += index[i][ref_col] + "\n";
						}
						page.drawText(content, option);
					} break;
					default:
						console.error('Unknown command');
				}
			}
		}
	} catch (e) {
		console.error(e);
		console.error(line, task, content, option);
	}
	
	callback(await doc.save());
};
