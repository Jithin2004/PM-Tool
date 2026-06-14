const fs = require('fs');
const path = require('path');

const srcDir = path.resolve('C:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/frontend/src/services');

const filesToPatch = [
    'workSessionService.ts',
    'waitStateEngine.ts',
    'sprintService.ts',
    'webhookService.ts',
    'documentTemplateService.ts',
    'pdfExportService.ts',
    'workspaceService.ts',
    'logisticsService.ts',
    'integrationService.ts',
    'meetingService.ts',
    'notificationService.ts',
    'capacityEngine.ts',
    'contextPredictionService.ts'
];

filesToPatch.forEach(file => {
    const filePath = path.join(srcDir, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('.limit(50)')) {
            content = content.replace(/\.limit\(50\)/g, '');
            fs.writeFileSync(filePath, content);
            console.log(`Removed .limit(50) from ${file}`);
        }
    }
});
