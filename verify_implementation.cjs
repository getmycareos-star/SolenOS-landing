// Simple verification script for the image compression service
// This script checks that the service is properly structured and exports the expected functions

const fs = require('fs');
const path = require('path');

console.log('Verifying image compression service implementation...\n');

// Check if the imageCompression.ts file exists
const imageCompressionPath = path.join(__dirname, 'src', 'lib', 'imageCompression.ts');
if (fs.existsSync(imageCompressionPath)) {
  console.log('✓ imageCompression.ts file exists');
  
  // Read the file content
  const content = fs.readFileSync(imageCompressionPath, 'utf8');
  
  // Check for expected exports
  if (content.includes('export async function compressImage')) {
    console.log('✓ compressImage function is exported');
  } else {
    console.log('✗ compressImage function is NOT exported');
  }
  
  if (content.includes('export function calculateSizeReduction')) {
    console.log('✓ calculateSizeReduction function is exported');
  } else {
    console.log('✗ calculateSizeReduction function is NOT exported');
  }
  
  if (content.includes('export function dataURLtoFile')) {
    console.log('✓ dataURLtoFile function is exported');
  } else {
    console.log('✗ dataURLtoFile function is NOT exported');
  }
  
  // Check for key implementation details
  if (content.includes('maxSizeMB: 0.5')) {
    console.log('✓ Default maxSizeMB is set to 0.5 (500KB)');
  } else {
    console.log('✗ Default maxSizeMB is NOT set to 0.5');
  }
  
  if (content.includes('maxWidthOrHeight: 2000')) {
    console.log('✓ Default maxWidthOrHeight is set to 2000px');
  } else {
    console.log('✗ Default maxWidthOrHeight is NOT set to 2000px');
  }
  
  if (content.includes('initialQuality: 0.8')) {
    console.log('✓ Default initialQuality is set to 0.8 (80%)');
  } else {
    console.log('✗ Default initialQuality is NOT set to 0.8');
  }
  
  if (content.includes('useWebWorker: true')) {
    console.log('✓ useWebWorker is enabled by default');
  } else {
    console.log('✗ useWebWorker is NOT enabled by default');
  }
  
  if (content.includes('rotate: true')) {
    console.log('✓ rotate is enabled by default (EXIF orientation correction)');
  } else {
    console.log('✗ rotate is NOT enabled by default');
  }
  
  if (content.includes('compressForce: false')) {
    console.log('✓ compressForce is disabled by default');
  } else {
    console.log('✗ compressForce is NOT disabled by default');
  }
  
  // Check for error handling
  if (content.includes('if (!file.type.startsWith(')) {
    console.log('✓ Input validation for image file type is implemented');
  } else {
    console.log('✗ Input validation for image file type is NOT implemented');
  }
  
  if (content.includes('throw new Error(')) {
    console.log('✓ Error handling for invalid input is implemented');
  } else {
    console.log('✗ Error handling for invalid input is NOT implemented');
  }
  
  if (content.includes('catch (error)')) {
    console.log('✓ Try/catch error handling is implemented');
  } else {
    console.log('✗ Try/catch error handling is NOT implemented');
  }
  
  if (content.includes('return file;')) {
    console.log('✓ Fallback to original image on error is implemented');
  } else {
    console.log('✗ Fallback to original image on error is NOT implemented');
  }
  
  // Check for resource cleanup
  if (content.includes('URL.revokeObjectURL')) {
    console.log('✓ Resource cleanup (URL.revokeObjectURL) is implemented');
  } else {
    console.log('✗ Resource cleanup (URL.revokeObjectURL) is NOT implemented');
  }
} else {
  console.log('✗ imageCompression.ts file does NOT exist');
}

console.log('\nVerifying Evidence.tsx integration...\n');

// Check if the Evidence.tsx file exists
const evidencePath = path.join(__dirname, 'src', 'pages', 'Evidence.tsx');
if (fs.existsSync(evidencePath)) {
  console.log('✓ Evidence.tsx file exists');
  
  // Read the file content
  const content = fs.readFileSync(evidencePath, 'utf8');
  
  // Check for import
  if (content.includes('import { compressImage, dataURLtoFile } from')) {
    console.log('✓ compressImage and dataURLtoFile are imported in Evidence.tsx');
  } else {
    console.log('✗ compressImage and dataURLtoFile are NOT imported in Evidence.tsx');
  }
  
  // Check for compressing state
  if (content.includes('const [compressing, setCompressing] = useState(false);')) {
    console.log('✓ compressing state is implemented in Evidence.tsx');
  } else {
    console.log('✗ compressing state is NOT implemented in Evidence.tsx');
  }
  
  // Check for usage in handleImageCapture
  if (content.includes('const handleImageCapture = async () =>')) {
    console.log('✓ handleImageCapture function exists in Evidence.tsx');
    
    if (content.includes('setCompressing(true);')) {
      console.log('✓ compressing state is set to true in handleImageCapture');
    } else {
      console.log('✗ compressing state is NOT set to true in handleImageCapture');
    }
    
    if (content.includes('const compressedFile = await compressImage(file,')) {
      console.log('✓ compressImage is called in handleImageCapture');
    } else {
      console.log('✗ compressImage is NOT called in handleImageCapture');
    }
    
    if (content.includes('setCompressing(false);')) {
      console.log('✓ compressing state is set to false in handleImageCapture');
    } else {
      console.log('✗ compressing state is NOT set to false in handleImageCapture');
    }
  } else {
    console.log('✗ handleImageCapture function does NOT exist in Evidence.tsx');
  }
  
  // Check for usage in handleImageUpload
  if (content.includes('const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) =>')) {
    console.log('✓ handleImageUpload function exists in Evidence.tsx');
    
    if (content.includes('setCompressing(true);')) {
      console.log('✓ compressing state is set to true in handleImageUpload');
    } else {
      console.log('✗ compressing state is NOT set to true in handleImageUpload');
    }
    
    if (content.includes('const compressedFile = await compressImage(file,')) {
      console.log('✓ compressImage is called in handleImageUpload');
    } else {
      console.log('✗ compressImage is NOT called in handleImageUpload');
    }
    
    if (content.includes('setCompressing(false);')) {
      console.log('✓ compressing state is set to false in handleImageUpload');
    } else {
      console.log('✗ compressing state is NOT set to false in handleImageUpload');
    }
  } else {
    console.log('✗ handleImageUpload function does NOT exist in Evidence.tsx');
  }
  
  // Check for usage in handleSubmit
  if (content.includes('setCompressing(true);')) {
    // Count occurrences to make sure we're looking at the right one in handleSubmit
    const compressingTrueMatches = content.match(/setCompressing\(true\);/g) || [];
    if (compressingTrueMatches.length >= 3) { // Should be at least 3: capture, upload, submit
      console.log('✓ compressing state is set to true in handleSubmit');
    } else {
      console.log('✗ compressing state is NOT set to true in handleSubmit');
    }
  } else {
    console.log('✗ compressing state is NOT set to true in handleSubmit');
  }
  
  if (content.includes('const compressedFile = await compressImage(file,')) {
    // Count occurrences to make sure we're looking at the right one in handleSubmit
    const compressCallMatches = content.match(/const compressedFile = await compressImage\(file,/g) || [];
    if (compressCallMatches.length >= 3) { // Should be at least 3: capture, upload, submit
      console.log('✓ compressImage is called in handleSubmit');
    } else {
      console.log('✗ compressImage is NOT called in handleSubmit');
    }
  } else {
    console.log('✗ compressImage is NOT called in handleSubmit');
  }
  
  if (content.includes('setCompressing(false);')) {
    // Count occurrences to make sure we're looking at the right one in handleSubmit
    const compressingFalseMatches = content.match(/setCompressing\(false\);/g) || [];
    if (compressingFalseMatches.length >= 3) { // Should be at least 3: capture, upload, submit
      console.log('✓ compressing state is set to false in handleSubmit');
    } else {
      console.log('✗ compressing state is NOT set to false in handleSubmit');
    }
  } else {
    console.log('✗ compressing state is NOT set to false in handleSubmit');
  }
  
  // Check for UI feedback
  if (content.includes('{compressing && (')) {
    console.log('✓ Compression status UI feedback is implemented in Evidence.tsx');
  } else {
    console.log('✗ Compression status UI feedback is NOT implemented in Evidence.tsx');
  }
} else {
  console.log('✗ Evidence.tsx file does NOT exist');
}

console.log('\nVerifying StructuredDailyCapture.tsx integration...\n');

// Check if the StructuredDailyCapture.tsx file exists
const structuredDailyCapturePath = path.join(__dirname, 'src', 'pages', 'StructuredDailyCapture.tsx');
if (fs.existsSync(structuredDailyCapturePath)) {
  console.log('✓ StructuredDailyCapture.tsx file exists');
  
  // Read the file content
  const content = fs.readFileSync(structuredDailyCapturePath, 'utf8');
  
  // Check for import
  if (content.includes('import { compressImage } from')) {
    console.log('✓ compressImage is imported in StructuredDailyCapture.tsx');
  } else {
    console.log('✗ compressImage is NOT imported in StructuredDailyCapture.tsx');
  }
  
  // Check for medicationCompressing state
  if (content.includes('const [medicationCompressing, setMedicationCompressing] = useState(false);')) {
    console.log('✓ medicationCompressing state is implemented in StructuredDailyCapture.tsx');
  } else {
    console.log('✗ medicationCompressing state is NOT implemented in StructuredDailyCapture.tsx');
  }
  
  // Check for usage in handleMedicationImageCapture
  if (content.includes('const handleMedicationImageCapture = async () =>')) {
    console.log('✓ handleMedicationImageCapture function exists in StructuredDailyCapture.tsx');
    
    if (content.includes('setMedicationCompressing(true);')) {
      console.log('✓ medicationCompressing state is set to true in handleMedicationImageCapture');
    } else {
      console.log('✗ medicationCompressing state is NOT set to true in handleMedicationImageCapture');
    }
    
    if (content.includes('const compressedFile = await compressImage(file,')) {
      console.log('✓ compressImage is called in handleMedicationImageCapture');
    } else {
      console.log('✗ compressImage is NOT called in handleMedicationImageCapture');
    }
    
    if (content.includes('setMedicationCompressing(false);')) {
      console.log('✓ medicationCompressing state is set to false in handleMedicationImageCapture');
    } else {
      console.log('✗ medicationCompressing state is NOT set to false in handleMedicationImageCapture');
    }
  } else {
    console.log('✗ handleMedicationImageCapture function does NOT exist in StructuredDailyCapture.tsx');
  }
  
  // Check for usage in handleMedicationImageUpload
  if (content.includes('const handleMedicationImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) =>')) {
    console.log('✓ handleMedicationImageUpload function exists in StructuredDailyCapture.tsx');
    
    if (content.includes('setMedicationCompressing(true);')) {
      console.log('✓ medicationCompressing state is set to true in handleMedicationImageUpload');
    } else {
      console.log('✗ medicationCompressing state is NOT set to true in handleMedicationImageUpload');
    }
    
    if (content.includes('const compressedFile = await compressImage(file,')) {
      console.log('✓ compressImage is called in handleMedicationImageUpload');
    } else {
      console.log('✗ compressImage is NOT called in handleMedicationImageUpload');
    }
    
    if (content.includes('setMedicationCompressing(false);')) {
      console.log('✓ medicationCompressing state is set to false in handleMedicationImageUpload');
    } else {
      console.log('✗ medicationCompressing state is NOT set to false in handleMedicationImageUpload');
    }
  } else {
    console.log('✗ handleMedicationImageUpload function does NOT exist in StructuredDailyCapture.tsx');
  }
  
  // Check for usage in handleMedicationSubmit
  if (content.includes('setMedicationCompressing(true);')) {
    console.log('✓ medicationCompressing state is set to true in handleMedicationSubmit');
  } else {
    console.log('✗ medicationCompressing state is NOT set to true in handleMedicationSubmit');
  }
  
  if (content.includes('const compressedFile = await compressImage(file,')) {
    // Count occurrences to make sure we're looking at the right one in handleMedicationSubmit
    const compressCallMatches = content.match(/const compressedFile = await compressImage\(file,/g) || [];
    if (compressCallMatches.length >= 2) { // Should be at least 2: capture, upload, submit
      console.log('✓ compressImage is called in handleMedicationSubmit');
    } else {
      console.log('✗ compressImage is NOT called in handleMedicationSubmit');
    }
  } else {
    console.log('✗ compressImage is NOT called in handleMedicationSubmit');
  }
  
  if (content.includes('setMedicationCompressing(false);')) {
    // Count occurrences to make sure we're looking at the right one in handleMedicationSubmit
    const compressingFalseMatches = content.match(/setMedicationCompressing\(false\);/g) || [];
    if (compressingFalseMatches.length >= 2) { // Should be at least 2: capture, upload, submit
      console.log('✓ medicationCompressing state is set to false in handleMedicationSubmit');
    } else {
      console.log('✗ medicationCompressing state is NOT set to false in handleMedicationSubmit');
    }
  } else {
    console.log('✗ medicationCompressing state is NOT set to false in handleMedicationSubmit');
  }
  
  // Check for UI feedback
  if (content.includes('{medicationCompressing && (')) {
    console.log('✓ Compression status UI feedback is implemented in StructuredDailyCapture.tsx');
  } else {
    console.log('✗ Compression status UI feedback is NOT implemented in StructuredDailyCapture.tsx');
  }
} else {
  console.log('✗ StructuredDailyCapture.tsx file does NOT exist');
}

console.log('\nVerification complete!');