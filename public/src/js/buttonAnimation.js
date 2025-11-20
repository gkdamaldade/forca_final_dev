// Script para animação de completar palavra nos botões
document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('.login-button[data-text-full]');
  
  buttons.forEach(button => {
    const textFull = button.getAttribute('data-text-full');
    const textShort = button.getAttribute('data-text-short');
    const buttonText = button.querySelector('.button-text');
    
    if (!buttonText) return;
    
    // Garante que o texto inicial seja o abreviado
    if (buttonText.textContent !== textShort) {
      buttonText.textContent = textShort;
    }
    
    // Obtém o estilo computado do texto original para alinhamento perfeito
    const computedStyle = window.getComputedStyle(buttonText);
    
    // Cria elemento para o texto completo
    const fullTextSpan = document.createElement('span');
    fullTextSpan.className = 'button-text-full';
    fullTextSpan.textContent = textFull;
    
    // Posiciona exatamente sobre o texto original
    fullTextSpan.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 0;
      overflow: hidden;
      white-space: nowrap;
      transition: width 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      color: white;
      font-weight: ${computedStyle.fontWeight};
      font-size: ${computedStyle.fontSize};
      font-family: ${computedStyle.fontFamily};
      letter-spacing: ${computedStyle.letterSpacing};
      line-height: ${computedStyle.lineHeight};
      text-shadow: 
        0 0 10px rgba(255, 255, 255, 0.5),
        0 0 20px rgba(0, 229, 255, 0.3);
      opacity: 0;
      transition: width 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s ease;
    `;
    
    button.appendChild(fullTextSpan);
    
    // Hover: completa a palavra
    button.addEventListener('mouseenter', () => {
      // Calcula a largura necessária para o texto completo
      const tempSpan = document.createElement('span');
      tempSpan.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: nowrap;
        font-weight: ${computedStyle.fontWeight};
        font-size: ${computedStyle.fontSize};
        font-family: ${computedStyle.fontFamily};
        letter-spacing: ${computedStyle.letterSpacing};
      `;
      tempSpan.textContent = textFull;
      document.body.appendChild(tempSpan);
      const fullWidth = tempSpan.offsetWidth;
      document.body.removeChild(tempSpan);
      
      // Anima o texto abreviado saindo
      buttonText.style.opacity = '0';
      buttonText.style.transform = 'translateX(-10px)';
      
      // Anima o texto completo entrando
      setTimeout(() => {
        fullTextSpan.style.width = `${fullWidth}px`;
        fullTextSpan.style.opacity = '1';
      }, 50);
    });
    
    // Mouse out: volta ao abreviado
    button.addEventListener('mouseleave', () => {
      fullTextSpan.style.opacity = '0';
      fullTextSpan.style.width = '0';
      
      setTimeout(() => {
        buttonText.style.opacity = '1';
        buttonText.style.transform = 'translateX(0)';
      }, 100);
    });
  });
});

