import './App.css'
import { Provider } from 'react-redux'
import { store } from './store/store'

function App() {
  

  return (
    <>
      <Provider store={store}>
        <div>
          <h1>Platica</h1>
        </div>
      </Provider>
    </>
  )
}

export default App
