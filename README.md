# Monitor Commander · Membro BR143

Instale **uma** das versões no Tampermonkey:

- [Instalar versão ofuscada](https://raw.githubusercontent.com/guijanuario/monitorCommanderMembro/main/userscripts/central-comandos-membro-br143-ofuscado.user.js)
- [Instalar versão normal](https://raw.githubusercontent.com/guijanuario/monitorCommanderMembro/main/userscripts/central-comandos-membro-br143.user.js)

Ao abrir o link Raw com o Tampermonkey instalado, confirme a instalação. Se o navegador mostrar apenas texto, abra o arquivo no GitHub e clique em **Raw**, ou importe a URL no painel do Tampermonkey. Não instale as duas versões ao mesmo tempo. Os arquivos têm `@updateURL` e `@downloadURL` para futuras atualizações.

O script funciona somente no mundo BR143. Ele lê os comandos recebidos da própria conta e os envia ao [servidor Monitor Commander](https://monitorcommander.guitw2025.workers.dev/) a cada cinco minutos enquanto a aba do jogo estiver aberta. Também oferece botões para sincronizar imediatamente e exportar os comandos. A partir da versão 1.3, transmite a cor do machado e a indicação de torre quando o jogo as apresenta. O tempo para identificação só pode ser mostrado quando a página fornece esse tempo.

**Privacidade e segurança:** o script contém uma credencial compartilhada apenas para envio. Quem baixar o arquivo pode extraí-la, mesmo na versão ofuscada, e enviar dados falsos. A credencial da liderança não está neste repositório. A versão normal permite revisar exatamente o código executado; a ofuscação dificulta a leitura casual, não cria proteção criptográfica.
