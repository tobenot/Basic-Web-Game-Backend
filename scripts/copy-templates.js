const fs = require('fs');
const path = require('path');

const appTemplatesSrc = path.join(__dirname, '..', 'src', 'templates');
const appTemplatesDist = path.join(__dirname, '..', 'dist', 'templates');
const frameworkTemplatesSrc = path.join(__dirname, '..', 'src', 'framework', 'templates');
const frameworkTemplatesDist = path.join(__dirname, '..', 'dist', 'framework', 'templates');

if (!fs.existsSync(appTemplatesDist)) fs.mkdirSync(appTemplatesDist, { recursive: true });
if (!fs.existsSync(frameworkTemplatesDist)) fs.mkdirSync(frameworkTemplatesDist, { recursive: true });

if (fs.existsSync(frameworkTemplatesSrc)) {
	fs.readdirSync(frameworkTemplatesSrc).forEach(file => {
		fs.copyFileSync(path.join(frameworkTemplatesSrc, file), path.join(frameworkTemplatesDist, file));
	});
	console.log('✅ Framework templates copied');
} else {
	console.log('ℹ️  No framework templates');
}

if (fs.existsSync(appTemplatesSrc)) {
	fs.readdirSync(appTemplatesSrc).forEach(file => {
		fs.copyFileSync(path.join(appTemplatesSrc, file), path.join(appTemplatesDist, file));
	});
	console.log('✅ App templates copied');
} else {
	console.log('ℹ️  No app templates');
}