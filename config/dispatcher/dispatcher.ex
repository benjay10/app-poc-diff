defmodule Dispatcher do
  use Matcher

  define_accept_types [
    html: [ "text/html", "application/xhtml+html" ],
    json: [ "application/json", "application/vnd.api+json" ],
    any:  ["*/*"]
  ]

  @html %{ accept: %{ html: true } }
  @json %{ accept: %{ json: true } }
  @any  %{ accept: %{ any:  true } }

  ## Resources for the webapp: JavaScript, CSS, images, ...
  match "/assets/*path", @any do
    forward conn, path, "http://frontend:4200/assets/"
  end

  match "/api/*path", @json do
    forward conn, path, "http://resource/"
  end

  get "/files/:id/download" do
    forward conn, [], "http://file/files/" <> id <> "/download"
  end

  get "/sync/files/*path" do
    forward conn, path, "http://producer/files/"
  end

  ## All HTML requests should be responded (as last resort) with the serving of the Ember webapp's HTML page
  match "/*path", @html do
    forward conn, path, "http://frontend:4200/"
  end

  #TODO: add a catch all to respond with a 404
end
