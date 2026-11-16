export const HelpCenter = {
  open: false,
  previousFocus: null,
  init() {
    const dialog = document.getElementById('helpDialog');
    const backdrop = document.getElementById('helpBackdrop');
    const show = () => {
      if (this.open) return;
      this.previousFocus = document.activeElement;
      this.open = true;
      dialog.classList.remove('hidden');
      backdrop.classList.remove('hidden');
      document.getElementById('closeHelpBtn')?.focus();
    };
    const hide = () => {
      if (!this.open) return;
      this.open = false;
      dialog.classList.add('hidden');
      backdrop.classList.add('hidden');
      if (this.previousFocus?.isConnected) this.previousFocus.focus();
    };
    document.getElementById('openHelpBtn')?.addEventListener('click', show);
    document.getElementById('closeHelpBtn')?.addEventListener('click', hide);
    backdrop?.addEventListener('click', hide);
    document.getElementById('helpStartTour')?.addEventListener('click', () => { hide(); document.getElementById('restartTourBtn')?.click(); });
    document.getElementById('helpOpenSetup')?.addEventListener('click', () => { hide(); document.getElementById('reopenSetupBtn')?.click(); });
    document.addEventListener('keydown', event => {
      if (!this.open) return;
      if (event.key === 'Escape') { event.preventDefault(); hide(); return; }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button:not([disabled]), summary')];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }
};
