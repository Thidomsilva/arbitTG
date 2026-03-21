// Monitor automático - Verifica arbitragens de usuários ativos
// Roda via Cron Job (a cada 5 minutos) ou pode ser chamado manualmente

module.exports = async (req, res) => {
  try {
    // Por enquanto, retorna sucesso
    // Será integrado com webhook quando em produção
    res.status(200).json({ 
      ok: true,
      message: 'Monitor job rodando'
    });
  } catch (error) {
    console.error('Monitor error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
};
