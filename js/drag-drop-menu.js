/**
 * Módulo de Drag-and-Drop para Menu Lateral
 * Permite reordenar relatórios de forma personalizada e salva no LocalStorage
 */

const DragDropMenu = (function() {
  'use strict';

  const STORAGE_KEY = 'relatorio_menu_order';
  let draggedElement = null;
  let draggedOverElement = null;
  let dragleaveTimer = null;

  /**
   * Inicializa o drag-and-drop no menu
   */
  function init(menuSelector = '#sidebarMenu') {
    const menu = document.querySelector(menuSelector);
    if (!menu) {
      console.warn('[DragDrop] Menu não encontrado:', menuSelector);
      return;
    }

    console.log('[DragDrop] Inicializando drag-and-drop...');
    attachEventListeners(menu);
    restoreMenuOrder(menu);
    console.log('[DragDrop] Drag-and-drop iniciado com sucesso');
  }

  /**
   * Anexa listeners de drag-and-drop aos items
   */
  function attachEventListeners(menu) {
    // Remover listeners antigos se existirem
    menu.removeEventListener('dragstart', handleDragStart);
    menu.removeEventListener('dragend', handleDragEnd);
    menu.removeEventListener('dragover', handleDragOver);
    menu.removeEventListener('drop', handleDrop);
    menu.removeEventListener('dragenter', handleDragEnter);
    menu.removeEventListener('dragleave', handleDragLeave);

    // Adicionar novos listeners
    menu.addEventListener('dragstart', handleDragStart, true);
    menu.addEventListener('dragend', handleDragEnd, true);
    menu.addEventListener('dragover', handleDragOver, false);
    menu.addEventListener('drop', handleDrop, false);
    menu.addEventListener('dragenter', handleDragEnter, true);
    menu.addEventListener('dragleave', handleDragLeave, true);

    // Marcar todos os items como draggable
    menu.querySelectorAll('.menu-item').forEach(item => {
      item.setAttribute('draggable', 'true');
      item.style.cursor = 'grab';
      item.style.touchAction = 'none';
    });
  }

  /**
   * Inicia o arrasto
   */
  function handleDragStart(e) {
    const item = e.target.closest('.menu-item');
    if (!item) return;

    draggedElement = item;
    draggedElement.style.opacity = '0.5';
    draggedElement.classList.add('dragging');
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', draggedElement.innerHTML);

    console.log('[DragDrop] Iniciando arrasto:', item.dataset.report);
  }

  /**
   * Finaliza o arrasto
   */
  function handleDragEnd(e) {
    if (draggedElement) {
      draggedElement.style.opacity = '1';
      draggedElement.classList.remove('dragging');
    }

    // Limpar todas as classes de drag visual
    const menu = document.querySelector('#sidebarMenu');
    if (menu) {
      menu.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('drag--over');
        item.classList.remove('drag--over-top');
        item.classList.remove('drag--over-bottom');
      });
    }

    draggedElement = null;
    draggedOverElement = null;

    if (dragleaveTimer) clearTimeout(dragleaveTimer);
  }

  /**
   * Permite o drop (drag over)
   */
  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  /**
   * Detecta quando entra em outro item
   */
  function handleDragEnter(e) {
    if (dragleaveTimer) clearTimeout(dragleaveTimer);

    const target = e.target.closest('.menu-item');
    if (!target || target === draggedElement) return;

    // Remover classe anterior
    if (draggedOverElement && draggedOverElement !== target) {
      draggedOverElement.classList.remove('drag--over');
      draggedOverElement.classList.remove('drag--over-top');
      draggedOverElement.classList.remove('drag--over-bottom');
    }

    draggedOverElement = target;
    target.classList.add('drag--over');

    // Determinar se é para cima ou para baixo
    const rect = target.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    
    if (e.clientY < midpoint) {
      target.classList.remove('drag--over-bottom');
      target.classList.add('drag--over-top');
    } else {
      target.classList.remove('drag--over-top');
      target.classList.add('drag--over-bottom');
    }
  }

  /**
   * Remove feedback visual ao sair de um item (com debounce)
   */
  function handleDragLeave(e) {
    if (dragleaveTimer) clearTimeout(dragleaveTimer);

    dragleaveTimer = setTimeout(() => {
      if (draggedOverElement) {
        draggedOverElement.classList.remove('drag--over');
        draggedOverElement.classList.remove('drag--over-top');
        draggedOverElement.classList.remove('drag--over-bottom');
      }
    }, 50);
  }

  /**
   * Processa o drop (reordenação)
   */
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    if (dragleaveTimer) clearTimeout(dragleaveTimer);

    console.log('[DragDrop] Drop detectado');
    console.log('[DragDrop] draggedElement:', draggedElement?.dataset.report);
    console.log('[DragDrop] draggedOverElement:', draggedOverElement?.dataset.report);

    if (!draggedElement || !draggedOverElement || draggedElement === draggedOverElement) {
      console.warn('[DragDrop] Drop cancelado - elementos inválidos');
      return false;
    }

    const menu = draggedElement.parentElement;
    if (!menu) {
      console.warn('[DragDrop] Menu pai não encontrado');
      return false;
    }

    // Determinar posição de drop
    const rect = draggedOverElement.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;

    if (e.clientY < midpoint) {
      // Drop acima
      console.log('[DragDrop] Drop ACIMA de', draggedOverElement.dataset.report);
      draggedOverElement.parentElement.insertBefore(draggedElement, draggedOverElement);
    } else {
      // Drop abaixo
      console.log('[DragDrop] Drop ABAIXO de', draggedOverElement.dataset.report);
      draggedOverElement.parentElement.insertBefore(draggedElement, draggedOverElement.nextSibling);
    }

    // Salvar nova ordem
    saveMenuOrder(menu);
    console.log('[DragDrop] Ordem salva com sucesso');

    return false;
  }

  /**
   * Salva a ordem dos items no LocalStorage
   */
  function saveMenuOrder(menu) {
    const order = Array.from(menu.querySelectorAll('.menu-item'))
      .map(item => item.dataset.report);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  }

  /**
   * Restaura a ordem salva do LocalStorage
   */
  function restoreMenuOrder(menu) {
    const savedOrder = localStorage.getItem(STORAGE_KEY);
    if (!savedOrder) return;

    try {
      const order = JSON.parse(savedOrder);
      const items = Array.from(menu.querySelectorAll('.menu-item'));

      // Criar mapa de items
      const itemMap = new Map(items.map(item => [item.dataset.report, item]));

      // Reordenar conforme salvo
      order.forEach(reportKey => {
        const item = itemMap.get(reportKey);
        if (item) {
          menu.appendChild(item);
        }
      });
    } catch (err) {
      console.warn('Erro ao restaurar ordem do menu:', err);
    }
  }

  /**
   * Limpar a ordem salva (resetar para padrão)
   */
  function resetMenuOrder() {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }

  /**
   * Obter a ordem atual
   */
  function getCurrentOrder() {
    const menu = document.querySelector('#sidebarMenu');
    if (!menu) return [];
    return Array.from(menu.querySelectorAll('.menu-item'))
      .map(item => item.dataset.report);
  }

  // API Pública
  return {
    init,
    resetMenuOrder,
    getCurrentOrder
  };

})();
