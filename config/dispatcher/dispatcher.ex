defmodule Dispatcher do
  use Matcher

  define_accept_types [
    json: [ "application/json", "application/vnd.api+json" ],
    html: [ "text/html", "application/xhtml+html" ],
    any: [ "*/*" ]
  ]

  @json %{ accept: %{ json: true } }
  @any %{ accept: %{ any: true } }
  @html %{ accept: %{ html: true } }

  match "/books/*path", @json do
    forward conn, path, "http://resource/books/"
  end
  match "/authors/*path", @json do
    forward conn, path, "http://resource/authors/"
  end

  get "/files/:id/download", @any do
    forward conn, [], "http://file/files/" <> id <> "/download"
  end

  get "/sync/files/*path", @any do
    forward conn, path, "http://producer/files/"
  end

  # host the frontend

  match "/assets/*path", @any do
    IO.puts "hi"
    forward conn, path, "http://frontend/assets/"
  end

  match "/favicon.ico", _ do
    IO.puts "hi"
    forward conn, [], "http://frontend/assets/favicon.ico"
  end

  match "/*path", @html do
    IO.puts "hi"
    IO.inspect( path, label: "Path to match:" )
    forward conn, [], "http://frontend/index.html"
  end
  
  # 404 - File not found

  match "/*_path", %{ last_call: true } do
    IO.puts "hi"
    send_resp( conn, 404, "Route not found.  See config/dispatcher.ex" )
  end
end
