
import html2canvas from 'html2canvas';

export const shareElementAsImage = async (element: HTMLElement, fileName: string) => {
  try {
    // Capture the element as a canvas
    const canvas = await html2canvas(element, { 
        backgroundColor: '#1f2937', // Match the modal background color (gray-800)
        scale: 2 // Improve quality
    }); 
    
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      
      const file = new File([blob], fileName, { type: 'image/png' });
      
      // Check if the Web Share API is supported and can share files
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Результат замера',
            text: 'Результат замера из приложения СГСМ'
          });
        } catch (error) {
           // User cancelled or share failed
           console.log('Sharing cancelled or failed:', error);
        }
      } else {
        // Fallback: Download the image
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }, 'image/png');
  } catch (error) {
    console.error('Error capturing image:', error);
    alert('Не удалось создать изображение для отправки.');
  }
};

export const saveElementAsImage = async (element: HTMLElement, fileName: string) => {
  try {
    const canvas = await html2canvas(element, { 
        backgroundColor: '#1f2937', 
        scale: 2 
    }); 
    
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, 'image/png');
  } catch (error) {
    console.error('Error saving image:', error);
    alert('Не удалось сохранить изображение.');
  }
};
