import React, { useState } from 'react';
// Import tất cả các export từ tệp biểu cảm của bạn
import * as Rios from './RioExpressions';

// Tự động lấy tên của tất cả các component kết thúc bằng "Rio"
// và loại bỏ các component cơ sở hoặc không phải là biểu cảm
const rioComponentNames = Object.keys(Rios).filter(
  (key) => key.endsWith('Rio') && key !== 'RioBase'
) as (keyof typeof Rios)[];

// Component nhỏ để hiển thị từng biểu cảm Rio trong một "thẻ" (card)
const RioPreview: React.FC<{ name: string; speed: number }> = ({ name, speed }) => {
  // Lấy component thực tế từ đối tượng Rios đã nhập
  const RioComponent = Rios[name as keyof typeof Rios] as React.FC<{ speed: number }>;

  if (!RioComponent) {
    return <div>Không tìm thấy component: {name}</div>;
  }

  return (
    <div style={{
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '8px',
      padding: '16px',
      margin: '8px',
      width: '200px',
      textAlign: 'center',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)'
    }}>
      {/* Vùng chứa SVG */}
      <div style={{ width: '150px', height: '150px', margin: '0 auto' }}>
        <RioComponent speed={speed} />
      </div>
      
      {/* Tên component */}
      <code style={{
        display: 'block',
        marginTop: '12px',
        fontSize: '14px',
        fontWeight: '500',
        color: 'white'
      }}>
        {name}
      </code>
    </div>
  );
};

// Component Gallery chính
export const RioGallery: React.FC = () => {
  // Sử dụng state để quản lý giá trị speed
  const [speed, setSpeed] = useState(4); // Tốc độ mặc định là 4s

  return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif', backgroundColor: 'transparent', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', textAlign: 'center', color: 'white' }}>
        🎨 Rio Expressions Gallery
      </h1>

      {/* Bảng điều khiển để "Sửa đổi" */}
      <div style={{
        marginBottom: '24px',
        padding: '16px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '8px',
        maxWidth: '800px',
        margin: '0 auto 24px auto',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <label
          htmlFor="speedSlider"
          style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: 'white' }}
        >
          Điều chỉnh tốc độ (Animation Speed): <strong>{speed.toFixed(1)}s</strong>
        </label>
        <input
          type="range"
          id="speedSlider"
          min="0.5"
          max="10"
          step="0.1"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          style={{ width: '100%' }}
        />
        <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', marginTop: '8px' }}>
          Thanh trượt này cập nhật prop <code style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '4px' }}>speed</code> cho tất cả các biểu cảm bên dưới.
        </p>
      </div>

      {/* Vùng "Xem trước" và "Quản lý" */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        {rioComponentNames.map((name) => (
          <RioPreview key={name} name={name} speed={speed} />
        ))}
      </div>
    </div>
  );
};

export default RioGallery;