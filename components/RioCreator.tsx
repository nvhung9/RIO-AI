import React, { useState } from 'react';
// Import RioBase từ tệp expressions của bạn để dùng cho xem trước
import { RioBase } from './RioExpressions'; // Đảm bảo đường dẫn này đúng

// --- Helper Functions ---

// Hàm tiện ích để viết hoa chữ cái đầu và thêm "Rio" (ví dụ: "happy" -> "HappyRio")
const formatComponentName = (name: string): string => {
  if (!name) return 'NewRio';
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, ''); // Xóa ký tự đặc biệt
  const capitalized = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  return capitalized.endsWith('Rio') ? capitalized : `${capitalized}Rio`;
};

// Hàm tạo khuôn mẫu mã
const generateCodeTemplate = (
  componentName: string,
  eyesSvg: string,
  mouthSvg: string,
  extrasSvg: string
): string => {
  const name = formatComponentName(componentName);

  // Thêm
  const eyes = eyesSvg.trim() ? `    {/* Mắt */}\n    ${eyesSvg}\n` : '';
  const mouth = mouthSvg.trim() ? `    {/* Miệng */}\n    ${mouthSvg}\n` : '';
  const extras = extrasSvg.trim() ? `    {/* Chi tiết thêm */}\n    ${extrasSvg}\n` : '';

  return `
export const ${name}: React.FC<RioProps> = (props) => (
  <RioBase {...props}>
${eyes}${mouth}${extras}  </RioBase>
);
  `.trim(); // .trim() để xóa dòng trắng thừa ở đầu
};

// --- Main Component ---

export const RioCreator: React.FC = () => {
  const [componentName, setComponentName] = useState('MyNew');
  const [eyesSvg, setEyesSvg] = useState('<path d="M 35,45 a 5,5 0 1,1 0,0.1" fill="black" />\n<path d="M 65,45 a 5,5 0 1,1 0,0.1" fill="black" />');
  const [mouthSvg, setMouthSvg] = useState('<path d="M 40,65 Q 50,75 60,65" stroke="black" strokeWidth="2.5" fill="none" />');
  const [extrasSvg, setExtrasSvg] = useState('');
  const [speed] = useState(4); // Tốc độ cố định cho xem trước

  // Lấy mã được tạo ra
  const generatedCode = generateCodeTemplate(componentName, eyesSvg, mouthSvg, extrasSvg);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    fontFamily: 'sans-serif',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
    maxWidth: '1200px',
    margin: '20px auto',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
  };

  const inputAreaStyle: React.CSSProperties = {
    flex: 2,
    padding: '20px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  const previewAreaStyle: React.CSSProperties = {
    flex: 1,
    padding: '20px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
  };

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '80px',
    fontFamily: 'monospace',
    fontSize: '13px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '4px',
    padding: '8px',
    boxSizing: 'border-box',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    color: 'white',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px',
    fontSize: '14px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '4px',
    boxSizing: 'border-box',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    color: 'white',
  };

  const labelStyle: React.CSSProperties = {
    fontWeight: 600,
    fontSize: '14px',
    marginBottom: '4px',
    display: 'block',
    color: 'white',
  };

  const codeBlockStyle: React.CSSProperties = {
    backgroundColor: '#1e1e1e', // Màu tối
    color: '#d4d4d4', // Màu sáng
    padding: '16px',
    borderRadius: '8px',
    overflowX: 'auto', // Cuộn ngang nếu cần
    fontSize: '14px',
    fontFamily: 'monospace',
    whiteSpace: 'pre', // Giữ nguyên khoảng trắng và xuống dòng
  };

  return (
    <div style={containerStyle}>
      {/* KHU VỰC NHẬP LIỆU VÀ TẠO MÃ */}
      <div style={inputAreaStyle}>
        <h2 style={{ margin: 0, paddingBottom: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.2)', color: 'white' }}>
          ✨ Rio Expression Creator
        </h2>
        
        {/* Tên Component */}
        <div>
          <label style={labelStyle} htmlFor="compName">Tên Component (ví dụ: Laughing)</label>
          <input
            id="compName"
            style={inputStyle}
            type="text"
            value={componentName}
            onChange={(e) => setComponentName(e.target.value)}
            placeholder="Ví dụ: Laughing, Crying,..."
          />
        </div>
        
        {/* SVG Mắt */}
        <div>
          <label style={labelStyle} htmlFor="eyesSvg">Mã SVG cho Mắt</label>
          <textarea
            id="eyesSvg"
            style={textareaStyle}
            value={eyesSvg}
            onChange={(e) => setEyesSvg(e.target.value)}
            placeholder='Ví dụ: <path d="..." />'
          />
        </div>

        {/* SVG Miệng */}
        <div>
          <label style={labelStyle} htmlFor="mouthSvg">Mã SVG cho Miệng</label>
          <textarea
            id="mouthSvg"
            style={textareaStyle}
            value={mouthSvg}
            onChange={(e) => setMouthSvg(e.target.value)}
            placeholder='Ví dụ: <path d="..." />'
          />
        </div>
        
        {/* SVG Chi tiết thêm */}
        <div>
          <label style={labelStyle} htmlFor="extrasSvg">Mã SVG cho Chi tiết thêm (tùy chọn)</label>
          <textarea
            id="extrasSvg"
            style={textareaStyle}
            value={extrasSvg}
            onChange={(e) => setExtrasSvg(e.target.value)}
            placeholder='Ví dụ: Lông mày, má hồng, ...'
          />
        </div>

        {/* KHU VỰC HIỂN THỊ MÃ ĐỂ SAO CHÉP */}
        <div>
          <label style={labelStyle}>Mã được tạo ra (Sao chép và dán vào RioExpressions.tsx)</label>
          <pre style={codeBlockStyle}>
            <code>{generatedCode}</code>
          </pre>
        </div>
      </div>

      {/* KHU VỰC XEM TRƯỚC */}
      <div style={previewAreaStyle}>
        <h3 style={{ margin: 0, color: 'white' }}>Xem trước trực tiếp</h3>
        
        <div style={{ width: '250px', height: '250px' }}>
          <RioBase speed={speed}>
            {/* Chúng ta sử dụng dangerouslySetInnerHTML để render chuỗi SVG 
              từ các ô textarea.
            */}
            <g dangerouslySetInnerHTML={{ __html: eyesSvg }} />
            <g dangerouslySetInnerHTML={{ __html: mouthSvg }} />
            <g dangerouslySetInnerHTML={{ __html: extrasSvg }} />
          </RioBase>
        </div>
        
        <code style={{ fontSize: '16px', fontWeight: 'bold', color: 'white', backgroundColor: 'rgba(0, 0, 0, 0.3)', padding: '4px 8px', borderRadius: '4px' }}>
          {formatComponentName(componentName)}
        </code>

        <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)', textAlign: 'center' }}>
          <p>💡 <strong>Mẹo:</strong> Bạn có thể sao chép SVG từ các component hiện có trong <code style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '4px' }}>RioExpressions.tsx</code> để dán vào đây và "chỉnh sửa"!</p>
          <p>Ví dụ: Lấy <code style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '4px' }}>&lt;HappyEyes /&gt;</code> và thay thế bằng các đường dẫn <code style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '4px' }}>path</code> thực tế của nó.</p>
        </div>
      </div>
    </div>
  );
};

export default RioCreator;