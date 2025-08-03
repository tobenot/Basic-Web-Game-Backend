const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'templates');
const distDir = path.join(__dirname, '..', 'dist', 'templates');

if (!fs.existsSync(distDir)) {
	fs.mkdirSync(distDir, { recursive: true });
}

if (fs.existsSync(srcDir)) {
	fs.readdirSync(srcDir).forEach(file => {
		fs.copyFileSync(path.join(srcDir, file), path.join(distDir, file));
	});
	console.log('✅ Templates copied successfully');
} else {
	console.log('⚠️  No templates directory found');
} 