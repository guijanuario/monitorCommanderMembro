# Monitor Commander · Membro BR143

Instale **uma** das versões no Tampermonkey:

- [Instalar versão ofuscada](https://raw.githubusercontent.com/guijanuario/monitorCommanderMembro/main/userscripts/central-comandos-membro-br143-ofuscado.user.js)
- [Instalar versão normal](https://raw.githubusercontent.com/guijanuario/monitorCommanderMembro/main/userscripts/central-comandos-membro-br143.user.js)

Ao abrir o link Raw com o Tampermonkey instalado, confirme a instalação. Se o navegador mostrar apenas texto, abra o arquivo no GitHub e clique em **Raw**, ou importe a URL no painel do Tampermonkey. Não instale as duas versões ao mesmo tempo. Os arquivos têm `@updateURL` e `@downloadURL` para futuras atualizações.

**Primeiro uso:** peça à liderança a credencial de envio por um canal privado. No jogo, abra o pequeno ícone da Central BR143 no canto superior esquerdo e clique em **Configurar credencial de envio**. Digite a credencial uma vez; ela fica salva no Tampermonkey desse navegador. A sincronização automática começa após a configuração. Não publique a credencial em mensagens públicas ou no GitHub.

O script funciona somente no mundo BR143. Ele lê os comandos recebidos da própria conta e os envia ao [servidor Monitor Commander](https://monitorcommander.guitw2025.workers.dev/) a cada cinco minutos enquanto a aba do jogo estiver aberta. Um ícone discreto no canto superior esquerdo abre as opções para sincronizar imediatamente ou exportar os comandos. A versão 1.4 distingue apoios de ataques, marca os ataques com nobre e envia também a cor do machado. O painel mostra o tempo restante até a chegada como cronômetro. O tempo para identificação por torre só pode ser mostrado quando a página fornece esse tempo.

**Privacidade e segurança:** a versão 1.4.1 não contém a credencial de envio nos arquivos publicados. A credencial compartilhada precisa ser fornecida privadamente pela liderança; quem a possuir pode enviar dados falsos. A credencial da liderança não está neste repositório. A versão normal permite revisar exatamente o código executado; a ofuscação dificulta a leitura casual, não cria proteção criptográfica.
