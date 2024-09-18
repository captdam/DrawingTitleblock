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

	let index = src.index.trim().split(/\n/g).map(x => x = x.replace(/\\n/g, "\n").split(','));
	for (let i = 0; i < index.length; i++) {
		const list = index[i].map(t => t = t.trim()).filter(t => t != '');
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
			switch (list.shift()) {
				case 'X': { // ['X',dummy_field]
					const dummy = list.shift();
					//console.log(dummy);
				} break;
				case 'T': { // ['T', x, y, size, height, r, g, b, a, rotate, 'text to write']
					const textOption = {
						x: list.shift() * 72, y: list.shift() * 72,
						size: list.shift() * 72, lineHeight: list.shift() * 72,
						color: PDFLib.rgb(Number(list.shift()), Number(list.shift()), Number(list.shift())), opacity: Number(list.shift()),
						rotate: PDFLib.degrees(Number(list.shift())),
					font: font};
					//console.log(textOption);
					page.drawText(list.shift(), textOption);
				} break;
				case 'P': { // ['P', x, y, w, h, rotate, picture_filename]
					const imageOption = {
						x: list.shift() * 72, y: list.shift() * 72,
						width: list.shift() * 72, height: list.shift() * 72,
						rotate: PDFLib.degrees(Number(list.shift())),
					};
					//console.log(imageOption);
					page.drawImage(src.pictures[list.shift()], imageOption);
				} break;
				case 'I': { // ['I', x, y, size, height, r, g, b, a, rotate, ref_col, ref_rowStart, ref_rowLen]
					const textOption = {
						x: list.shift() * 72, y: list.shift() * 72,
						size: list.shift() * 72, lineHeight: list.shift() * 72,
						color: PDFLib.rgb(Number(list.shift()), Number(list.shift()), Number(list.shift())), opacity: Number(list.shift()),
						rotate: PDFLib.degrees(Number(list.shift())),
					font: font};
					//console.log(textOption);
					const ref_col = list.shift() - 1, ref_rowStart = list.shift() - 1, ref_rowEnd = ref_rowStart +  Number(list.shift());
					let text = '';
					for (let i = ref_rowStart; i < ref_rowEnd; i++) {
						//console.log(index[i][ref_col]);
						text += index[i][ref_col] + "\n";
					}
					page.drawText(text, textOption);
				} break;
				default:
					console.error('Unknown command');
			}
		}
	}
	
	callback(await doc.save());
};