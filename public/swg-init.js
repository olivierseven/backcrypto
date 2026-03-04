/**
 * Google Reader Revenue Manager - Init (Subscribe with Google)
 * Sincroniza com o CMS conforme snippet do Google Reader Revenue Manager
 */
(self.SWG_BASIC = self.SWG_BASIC || []).push(function (basicSubscriptions) {
  basicSubscriptions.init({
    type: "NewsArticle",
    isPartOfType: ["Product"],
    isPartOfProductId: "CAow4fzeCw:openaccess",
    clientOptions: { theme: "light", lang: "pt-BR" },
  });
});
