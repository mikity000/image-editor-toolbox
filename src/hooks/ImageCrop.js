import CropperComponent from '../components/CropperComponent';
import '../styles.css';

const ImageTrimming = () => {
  return (
    <div className="app-container">
      <h1 className="app-title">画像クロップ</h1>
      <CropperComponent />
    </div>
  );
};

export default ImageTrimming;