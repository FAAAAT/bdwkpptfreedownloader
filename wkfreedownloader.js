function dataURLtoFile(dataurl, filename) {
    var arr = dataurl.split(","),
        mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[arr.length - 1]),
        n = bstr.length,
        u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

function blobToFile(theBlob, fileName) {
    return new File([theBlob], fileName, {type: theBlob.type});
}

// thanks for prakash-niroula
// from https://github.com/pwasystem/zip/
class Zip {

    constructor(name) {
        this.name = name;
        this.zip = new Array();
        this.file = new Array();
    }

    dec2bin = (dec, size) => dec.toString(2).padStart(size, '0');
    str2dec = str => Array.from(new TextEncoder().encode(str));
    str2hex = str => [...new TextEncoder().encode(str)].map(x => x.toString(16).padStart(2, '0'));
    hex2buf = hex => new Uint8Array(hex.split(' ').map(x => parseInt(x, 16)));
    bin2hex = bin => (parseInt(bin.slice(8), 2).toString(16).padStart(2, '0') + ' ' + parseInt(bin.slice(0, 8), 2).toString(16).padStart(2, '0'));

    reverse = hex => {
        let hexArray = new Array();
        for (let i = 0; i < hex.length; i = i + 2)hexArray[i] = hex[i] + '' + hex[i + 1];
        return hexArray.filter((a) => a).reverse().join(' ');
    }

    crc32 = r => {
        for (var a, o = [], c = 0; c < 256; c++) {
            a = c;
            for (var f = 0; f < 8; f++)a = 1 & a ? 3988292384 ^ a >>> 1 : a >>> 1;
            o[c] = a;
        }
        for (var n = -1, t = 0; t < r.length; t++)n = n >>> 8 ^ o[255 & (n ^ r[t])];
        return this.reverse(((-1 ^ n) >>> 0).toString(16).padStart(8, '0'));
    }

    fecth2zip(filesArray, folder = '') {
        filesArray.forEach(fileUrl => {
            let resp;
            fetch(fileUrl).then(response => {
                resp = response;
                return response.arrayBuffer();
            }).then(blob => {
                new Response(blob).arrayBuffer().then(buffer => {
                    console.log(`File: ${fileUrl} load`);
                    let uint = [...new Uint8Array(buffer)];
                    uint.modTime = resp.headers.get('Last-Modified');
                    uint.fileUrl = `${this.name}/${folder}${fileUrl}`;
                    this.zip[fileUrl] = uint;
                });
            });
        });
    }

    str2zip(name, str, folder = '') {
        let uint = [...new Uint8Array(this.str2dec(str))];
        uint.name = name;
        uint.modTime = new Date();
        uint.fileUrl = `${this.name}/${folder}${name}`;
        this.zip[name] = uint;
    }

    async files2zip(files, folder = '') {
        for (let i = 0; i < files.length; i++) {
            let data = await files[i].arrayBuffer();
            let uint = [...new Uint8Array(data)];
            uint.name = files[i].name;
            uint.modTime = files[i].lastModifiedDate;
            uint.fileUrl = `${this.name}/${folder}${files[i].name}`;
            this.zip[uint.fileUrl] = uint;
        }
    }

    makeZip() {
        let count = 0;
        let fileHeader = '';
        let centralDirectoryFileHeader = '';
        let directoryInit = 0;
        let offSetLocalHeader = '00 00 00 00';
        let zip = this.zip;
        for (const name in zip) {
            let lastMod, hour, minutes, seconds, year, month, day;
            let modTime = () => {
                lastMod = new Date(zip[name].modTime);
                hour = this.dec2bin(lastMod.getHours(), 5);
                minutes = this.dec2bin(lastMod.getMinutes(), 6);
                seconds = this.dec2bin(Math.round(lastMod.getSeconds() / 2), 5);
                year = this.dec2bin(lastMod.getFullYear() - 1980, 7);
                month = this.dec2bin(lastMod.getMonth() + 1, 4);
                day = this.dec2bin(lastMod.getDate(), 5);
                return this.bin2hex(`${hour}${minutes}${seconds}`) + ' ' + this.bin2hex(`${year}${month}${day}`);
            }
            let crc = this.crc32(zip[name]);
            let size = this.reverse(parseInt(zip[name].length).toString(16).padStart(8, '0'));
            let nameFile = this.str2hex(zip[name].fileUrl).join(' ');
            let nameSize = this.reverse(zip[name].fileUrl.length.toString(16).padStart(4, '0'));
            let fileHeader = `50 4B 03 04 14 00 00 00 00 00 ${modTime()} ${crc} ${size} ${size} ${nameSize} 00 00 ${nameFile}`;
            let fileHeaderBuffer = this.hex2buf(fileHeader);
            directoryInit = directoryInit + fileHeaderBuffer.length + zip[name].length;
            centralDirectoryFileHeader = `${centralDirectoryFileHeader}50 4B 01 02 14 00 14 00 00 00 00 00 ${modTime()} ${crc} ${size} ${size} ${nameSize} 00 00 00 00 00 00 01 00 20 00 00 00 ${offSetLocalHeader} ${nameFile} `;
            offSetLocalHeader = this.reverse(directoryInit.toString(16).padStart(8, '0'));
            this.file.push(fileHeaderBuffer, new Uint8Array(zip[name]));
            count++;
        }
        centralDirectoryFileHeader = centralDirectoryFileHeader.trim();
        let entries = this.reverse(count.toString(16).padStart(4, '0'));
        let dirSize = this.reverse(centralDirectoryFileHeader.split(' ').length.toString(16).padStart(8, '0'));
        let dirInit = this.reverse(directoryInit.toString(16).padStart(8, '0'));
        let centralDirectory = `50 4b 05 06 00 00 00 00 ${entries} ${entries} ${dirSize} ${dirInit} 00 00`;


        this.file.push(this.hex2buf(centralDirectoryFileHeader), this.hex2buf(centralDirectory));

        let a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([...this.file], { type: 'application/octet-stream' }));
        console.log(a.href)
        a.download = `${this.name}.zip`;
        a.click();
    }
}

const FileMimeType = {
    'audio/x-mpeg': 'mpega',
    'application/postscript': 'ps',
    'audio/x-aiff': 'aiff',
    'application/x-aim': 'aim',
    'image/x-jg': 'art',
    'video/x-ms-asf': 'asx',
    'audio/basic': 'ulw',
    'video/x-msvideo': 'avi',
    'video/x-rad-screenplay': 'avx',
    'application/x-bcpio': 'bcpio',
    'application/octet-stream': 'exe',
    'image/bmp': 'dib',
    'text/html': 'html',
    'application/x-cdf': 'cdf',
    'application/pkix-cert': 'cer',
    'application/java': 'class',
    'application/x-cpio': 'cpio',
    'application/x-csh': 'csh',
    'text/css': 'css',
    'application/msword': 'doc',
    'application/xml-dtd': 'dtd',
    'video/x-dv': 'dv',
    'application/x-dvi': 'dvi',
    'application/vnd.ms-fontobject': 'eot',
    'text/x-setext': 'etx',
    'image/gif': 'gif',
    'application/x-gtar': 'gtar',
    'application/x-gzip': 'gz',
    'application/x-hdf': 'hdf',
    'application/mac-binhex40': 'hqx',
    'text/x-component': 'htc',
    'image/ief': 'ief',
    'text/vnd.sun.j2me.app-descriptor': 'jad',
    'application/java-archive': 'jar',
    'text/x-java-source': 'java',
    'application/x-java-jnlp-file': 'jnlp',
    'image/jpeg': 'jpg',
    'application/javascript': 'js',
    'text/plain': 'txt',
    'application/json': 'json',
    'audio/midi': 'midi',
    'application/x-latex': 'latex',
    'audio/x-mpegurl': 'm3u',
    'image/x-macpaint': 'pnt',
    'text/troff': 'tr',
    'application/mathml+xml': 'mathml',
    'application/x-mif': 'mif',
    'video/quicktime': 'qt',
    'video/x-sgi-movie': 'movie',
    'audio/mpeg': 'mpa',
    'video/mp4': 'mp4',
    'video/mpeg': 'mpg',
    'video/mpeg2': 'mpv2',
    'application/x-wais-source': 'src',
    'application/x-netcdf': 'nc',
    'application/oda': 'oda',
    'application/vnd.oasis.opendocument.database': 'odb',
    'application/vnd.oasis.opendocument.chart': 'odc',
    'application/vnd.oasis.opendocument.formula': 'odf',
    'application/vnd.oasis.opendocument.graphics': 'odg',
    'application/vnd.oasis.opendocument.image': 'odi',
    'application/vnd.oasis.opendocument.text-master': 'odm',
    'application/vnd.oasis.opendocument.presentation': 'odp',
    'application/vnd.oasis.opendocument.spreadsheet': 'ods',
    'application/vnd.oasis.opendocument.text': 'odt',
    'application/vnd.oasis.opendocument.graphics-template': 'otg',
    'application/vnd.oasis.opendocument.text-web': 'oth',
    'application/vnd.oasis.opendocument.presentation-template': 'otp',
    'application/vnd.oasis.opendocument.spreadsheet-template': 'ots',
    'application/vnd.oasis.opendocument.text-template': 'ott',
    'application/ogg': 'ogx',
    'video/ogg': 'ogv',
    'audio/ogg': 'spx',
    'application/x-font-opentype': 'otf',
    'audio/flac': 'flac',
    'application/annodex': 'anx',
    'audio/annodex': 'axa',
    'video/annodex': 'axv',
    'application/xspf+xml': 'xspf',
    'image/x-portable-bitmap': 'pbm',
    'image/pict': 'pict',
    'application/pdf': 'pdf',
    'image/x-portable-graymap': 'pgm',
    'audio/x-scpls': 'pls',
    'image/png': 'png',
    'image/x-portable-anymap': 'pnm',
    'image/x-portable-pixmap': 'ppm',
    'application/vnd.ms-powerpoint': 'pps',
    'image/vnd.adobe.photoshop': 'psd',
    'image/x-quicktime': 'qtif',
    'image/x-cmu-raster': 'ras',
    'application/rdf+xml': 'rdf',
    'image/x-rgb': 'rgb',
    'application/vnd.rn-realmedia': 'rm',
    'application/rtf': 'rtf',
    'text/richtext': 'rtx',
    'application/font-sfnt': 'sfnt',
    'application/x-sh': 'sh',
    'application/x-shar': 'shar',
    'application/x-stuffit': 'sit',
    'application/x-sv4cpio': 'sv4cpio',
    'application/x-sv4crc': 'sv4crc',
    'image/svg+xml': 'svgz',
    'application/x-shockwave-flash': 'swf',
    'application/x-tar': 'tar',
    'application/x-tcl': 'tcl',
    'application/x-tex': 'tex',
    'application/x-texinfo': 'texinfo',
    'image/tiff': 'tiff',
    'text/tab-separated-values': 'tsv',
    'application/x-font-ttf': 'ttf',
    'application/x-ustar': 'ustar',
    'application/voicexml+xml': 'vxml',
    'image/x-xbitmap': 'xbm',
    'application/xhtml+xml': 'xhtml',
    'application/vnd.ms-excel': 'xls',
    'application/xml': 'xsl',
    'image/x-xpixmap': 'xpm',
    'application/xslt+xml': 'xslt',
    'application/vnd.mozilla.xul+xml': 'xul',
    'image/x-xwindowdump': 'xwd',
    'application/vnd.visio': 'vsd',
    'audio/x-wav': 'wav',
    'image/vnd.wap.wbmp': 'wbmp',
    'text/vnd.wap.wml': 'wml',
    'application/vnd.wap.wmlc': 'wmlc',
    'text/vnd.wap.wmlsc': 'wmls',
    'application/vnd.wap.wmlscriptc': 'wmlscriptc',
    'video/x-ms-wmv': 'wmv',
    'application/font-woff': 'woff',
    'application/font-woff2': 'woff2',
    'model/vrml': 'wrl',
    'application/wspolicy+xml': 'wspolicy',
    'application/x-compress': 'z',
    'application/zip': 'zip'
};

async function  download() {
    let z = new Zip("ppt.zip");

    let capture_resource = performance.getEntriesByType("resource");

    capture_resource = capture_resource.filter(x => x.name.indexOf("wkretype") >= 0)

    let files = [];
    for (let i = 0; i < capture_resource.length; i++) {
        let curData = capture_resource[i];
        let response = await fetch(curData.name);
        if (response.ok) {
            let data = await response.blob();
            let file = blobToFile(data, "ppt" + i + "." + FileMimeType[data.type])
            files.push(file);
        } else {
            console.log(curData.name + " download failed");
        }
    }
    console.log(files);
    await z.files2zip(files);
    z.makeZip();
}

