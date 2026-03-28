import PdfComponent from '../components/PdfComponent';
import '../styles.css';

const ImagePdf = () => {
  return (
    <div className="app-container">
      <h1 className="app-title">画像PDF化</h1>
      <PdfComponent />
    </div>
  );
};

export default ImagePdf;